import {
  getProductActionsForChat,
  getProductByPublicKey,
  getProductContentForChat,
} from "../../../../../features/products/queries";
import { handleTelegramActionCallback } from "../../../../../features/products/telegram-action-callback";
import { handleTelegramWalletCommands } from "../../../../../features/products/telegram-wallet-commands";
import {
  buildPendingCallbackData,
  createPendingActionConfirm,
} from "../../../../../features/products/pending-action-confirms";
import { markdownToTelegramHtml } from "../../../../../features/products/telegram-html";
import {
  sendTelegramMessage,
  type TelegramUpdate,
} from "../../../../../features/products/telegram";
import {
  actionIdFromToolName,
  buildWidgetSystemPrompt,
  buildWidgetTools,
  createRateLimiter,
  proposeWidgetAction,
} from "../../../../../features/products/widget-chat";
import { createLlmChatCompletion, getLlmConfig } from "../../../../../lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOKENS = 700;
const MAX_TOOL_HOPS = 3;

const allowRequest = createRateLimiter(30, 60_000);

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

/** Normalize tool params into a value we can store + later run. */
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

export async function POST(request: Request, context: { params: Promise<{ publicKey: string }> }) {
  const { publicKey: rawKey } = await context.params;
  const publicKey = decodeURIComponent(rawKey ?? "").trim();
  if (!publicKey) return new Response("Missing public key.", { status: 400 });

  const product = await getProductByPublicKey(publicKey);
  if (!product) return new Response("Agent not found.", { status: 404 });

  const settings = (product.settings as Record<string, unknown>) ?? {};
  const token = typeof settings.telegramBotToken === "string" ? settings.telegramBotToken : null;
  const enabled = settings.telegramBotEnabled !== false;
  const secretToken =
    typeof settings.telegramSecretToken === "string" ? settings.telegramSecretToken : null;

  if (!token || !enabled) {
    return new Response("Telegram bot is not configured or disabled for this agent.", {
      status: 400,
    });
  }

  if (secretToken) {
    const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== secretToken) {
      return new Response("Unauthorized webhook request.", { status: 401 });
    }
  }

  const llm = getLlmConfig();
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return new Response("Invalid payload", { status: 400 });

  const dashboardBase = (
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");

  if (update.callback_query) {
    await handleTelegramActionCallback({
      token,
      publicKey,
      productId: product.id,
      callback: update.callback_query,
    });
    return new Response("OK", { status: 200 });
  }

  const msg = update.message;
  if (!msg || !msg.text || msg.from?.is_bot) {
    return new Response("OK", { status: 200 });
  }

  const chatId = msg.chat.id;
  const userText = msg.text.trim();
  const telegramUserId = msg.from?.id != null ? String(msg.from.id) : null;
  const command = userText.split(/\s+/)[0]?.split("@")[0]?.toLowerCase() ?? "";
  const isStart = command === "/start";

  if (!allowRequest(`${publicKey}:${chatId}`)) {
    await sendTelegramMessage(token, chatId, "Too many requests. Please wait a minute.");
    return new Response("OK", { status: 200 });
  }

  if (
    await handleTelegramWalletCommands({
      token,
      chatId,
      command,
      telegramUserId,
      product,
      dashboardBase,
    })
  ) {
    return new Response("OK", { status: 200 });
  }

  if (!llm) {
    await sendTelegramMessage(
      token,
      chatId,
      "The agent is currently unavailable (missing model key).",
    );
    return new Response("OK", { status: 200 });
  }

  const [content, actions] = await Promise.all([
    getProductContentForChat(product.id),
    getProductActionsForChat(product.id),
  ]);

  // Telegram webhooks are single-turn (no history), so greet only on /start.
  const system = buildWidgetSystemPrompt(product, content, actions, {
    allowGreeting: isStart,
  });
  const tools = buildWidgetTools(actions);
  const actionsById = new Map(actions.map((a) => [a.id, a]));

  const convo: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userText.slice(0, 4000) },
  ];

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
      const resp = await createLlmChatCompletion(llm, {
        messages: convo,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: MAX_TOKENS,
        title: "Tael Telegram Agent",
      });

      if (!resp.ok) {
        await sendTelegramMessage(
          token,
          chatId,
          "The agent is currently unavailable. Please try again later.",
        );
        return new Response("OK", { status: 200 });
      }

      const data = (await resp.json()) as OpenRouterResponse;
      const message = data.choices?.[0]?.message;
      if (!message) {
        await sendTelegramMessage(token, chatId, "No response received from the agent.");
        return new Response("OK", { status: 200 });
      }

      if (message.tool_calls?.length) {
        for (const call of message.tool_calls) {
          const actionId = actionIdFromToolName(call.function.name);
          if (!actionId) continue;
          const action = actionsById.get(actionId);
          if (!action) continue;

          const args = safeParseArgs(call.function.arguments);
          const proposed = proposeWidgetAction(action, args);
          const pendingParams = normalizeToolParams(args.params);
          const pendingToken = await createPendingActionConfirm({
            productId: product.id,
            actionId: action.id,
            channel: "telegram",
            externalUserId: telegramUserId,
            params: pendingParams,
          });
          const callbackData = buildPendingCallbackData(pendingToken);

          await sendTelegramMessage(
            token,
            chatId,
            markdownToTelegramHtml(
              `${proposed.reply}\n\nNeed a linked wallet? Send /connect first.`,
            ),
            {
              parseMode: "HTML",
              replyMarkup: {
                inline_keyboard: [[{ text: `Run ${action.name}`, callback_data: callbackData }]],
              },
            },
          );
          return new Response("OK", { status: 200 });
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
      if (text) {
        await sendTelegramMessage(token, chatId, markdownToTelegramHtml(text), {
          parseMode: "HTML",
        });
      }
      return new Response("OK", { status: 200 });
    }

    await sendTelegramMessage(
      token,
      chatId,
      "I couldn't quite complete that request. Could you rephrase?",
    );
    return new Response("OK", { status: 200 });
  } catch {
    await sendTelegramMessage(token, chatId, "An error occurred while processing your request.");
    return new Response("OK", { status: 200 });
  }
}
