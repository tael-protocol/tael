import type { Product } from "@tael/database";
import { createLlmChatCompletion, getLlmConfig } from "../../lib/llm";
import { getProductActionsForChat, getProductContentForChat } from "./queries";
import { editDiscordInteractionResponse } from "./discord";
import { createPendingActionConfirm, consumePendingActionConfirm } from "./pending-action-confirms";
import { getEnabledActionForPublicKey, runProductAction } from "./run-product-action";
import {
  actionIdFromToolName,
  buildWidgetSystemPrompt,
  buildWidgetTools,
  proposeWidgetAction,
} from "./widget-chat";

const MAX_TOKENS = 700;
const MAX_TOOL_HOPS = 3;

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenRouterResponse {
  choices?: { message?: ChatMessage }[];
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeToolParams(raw: unknown): string | Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  const asString = String(raw).trim();
  if (!asString) return null;
  if (asString.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(asString);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep string
    }
  }
  return asString;
}

function runPendingButton(token: string): unknown[] {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "Run action",
          custom_id: `c:${token}`.slice(0, 100),
        },
      ],
    },
  ];
}

export async function handleDiscordActionConfirm(
  publicKey: string,
  productId: string,
  applicationId: string,
  interactionToken: string,
  pendingToken: string,
  discordUserId?: string | null,
): Promise<void> {
  const pending = await consumePendingActionConfirm({
    token: pendingToken,
    channel: "discord",
    externalUserId: discordUserId,
  });
  if (!pending || pending.productId !== productId) {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      "This confirmation expired. Ask again to get a new button.",
    );
    return;
  }

  const check = await getEnabledActionForPublicKey(publicKey, pending.actionId);
  if (!check.ok) {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      `Action failed: ${check.error}`,
    );
    return;
  }

  const res = await runProductAction({
    actionId: check.actionId,
    params: pending.params,
  });

  if (res.ok) {
    const output = res.body ? `\n\`\`\`\n${res.body.slice(0, 1500)}\n\`\`\`` : "";
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      `Action executed successfully.${output}`,
    );
    return;
  }

  await editDiscordInteractionResponse(
    applicationId,
    interactionToken,
    `Action failed: ${res.error ?? "Unknown error"}`,
  );
}

export async function handleDiscordAsk(
  product: Product,
  applicationId: string,
  interactionToken: string,
  question: string,
  discordUserId?: string | null,
): Promise<void> {
  const llm = getLlmConfig();
  if (!llm) {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      "The agent is currently unavailable (missing model key).",
    );
    return;
  }

  const [content, actions] = await Promise.all([
    getProductContentForChat(product.id),
    getProductActionsForChat(product.id),
  ]);

  // Each /ask is single-turn — never open with a canned greeting.
  const system = buildWidgetSystemPrompt(product, content, actions, {
    allowGreeting: false,
  });
  const tools = buildWidgetTools(actions);
  const actionsById = new Map(actions.map((a) => [a.id, a]));

  const convo: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: question.slice(0, 4000) },
  ];

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
      const resp = await createLlmChatCompletion(llm, {
        messages: convo,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: MAX_TOKENS,
        title: "Tael Discord Agent",
      });

      if (!resp.ok) {
        await editDiscordInteractionResponse(
          applicationId,
          interactionToken,
          "The agent is currently unavailable. Please try again later.",
        );
        return;
      }

      const data = (await resp.json()) as OpenRouterResponse;
      const message = data.choices?.[0]?.message;
      if (!message) {
        await editDiscordInteractionResponse(
          applicationId,
          interactionToken,
          "No response received from the agent.",
        );
        return;
      }

      if (message.tool_calls?.length) {
        for (const call of message.tool_calls) {
          const actionId = actionIdFromToolName(call.function.name);
          if (!actionId) continue;
          const action = actionsById.get(actionId);
          if (!action) continue;

          const args = safeParseArgs(call.function.arguments);
          const proposed = proposeWidgetAction(action, args);
          const pendingToken = await createPendingActionConfirm({
            productId: product.id,
            actionId: action.id,
            channel: "discord",
            externalUserId: discordUserId,
            params: normalizeToolParams(args.params),
          });

          await editDiscordInteractionResponse(
            applicationId,
            interactionToken,
            proposed.reply,
            runPendingButton(pendingToken),
          );
          return;
        }

        convo.push(message);
        for (const call of message.tool_calls) {
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({ error: "unknown action" }),
          });
        }
        continue;
      }

      const text = typeof message.content === "string" ? message.content.trim() : "";
      await editDiscordInteractionResponse(
        applicationId,
        interactionToken,
        text || "I could not find an answer for that.",
      );
      return;
    }

    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      "I couldn't quite complete that request. Could you rephrase?",
    );
  } catch {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      "An error occurred while processing your request.",
    );
  }
}
