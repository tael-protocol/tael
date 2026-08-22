import type { Product } from "@tael/database";
import { getProductActionsForChat, getProductContentForChat } from "./queries";
import { editDiscordInteractionResponse } from "./discord";
import { getEnabledActionForPublicKey, runProductAction } from "./run-product-action";
import {
  actionIdFromToolName,
  buildWidgetSystemPrompt,
  buildWidgetTools,
  proposeWidgetAction,
} from "./widget-chat";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
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

function runActionButton(actionId: string, paramsStr: string): unknown[] {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "Run action",
          custom_id: `run:${actionId}:${paramsStr}`.slice(0, 100),
        },
      ],
    },
  ];
}

export async function handleDiscordActionConfirm(
  publicKey: string,
  applicationId: string,
  interactionToken: string,
  actionId: string,
  paramsStr: string,
): Promise<void> {
  const check = await getEnabledActionForPublicKey(publicKey, actionId);
  if (!check.ok) {
    await editDiscordInteractionResponse(
      applicationId,
      interactionToken,
      `Action failed: ${check.error}`,
    );
    return;
  }

  let parsedParams: Record<string, unknown> | string | undefined = paramsStr || undefined;
  if (paramsStr) {
    try {
      parsedParams = JSON.parse(paramsStr) as Record<string, unknown>;
    } catch {
      parsedParams = { value: paramsStr };
    }
  }

  const res = await runProductAction({
    actionId: check.actionId,
    params: parsedParams,
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
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
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

  const system = buildWidgetSystemPrompt(product, content, actions);
  const tools = buildWidgetTools(actions);
  const actionsById = new Map(actions.map((a) => [a.id, a]));

  const convo: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: question.slice(0, 4000) },
  ];

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "HTTP-Referer": "https://taelprotocol.xyz",
          "X-Title": "Tael Discord Agent",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: convo,
          ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
          max_tokens: MAX_TOKENS,
          temperature: 0.3,
        }),
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
          const paramsStr = args.params != null ? String(args.params) : "";

          await editDiscordInteractionResponse(
            applicationId,
            interactionToken,
            proposed.reply,
            runActionButton(action.id, paramsStr),
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
