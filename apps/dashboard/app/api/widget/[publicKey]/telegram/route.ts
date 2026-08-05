import {
  getProductActionsForChat,
  getProductByPublicKey,
  getProductContentForChat,
} from "../../../../../features/products/queries";
import {
  getEnabledActionForPublicKey,
  runProductAction,
} from "../../../../../features/products/run-product-action";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
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

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
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

/** Formats a compact callback_data string under Telegram's strict 64-byte limit. */
function buildCallbackData(actionId: string, paramsStr: string): string {
  const hex = actionId.replace(/-/g, ""); // 32 chars
  const prefix = `a:${hex}`; // 34 chars
  if (!paramsStr) return prefix;
  const maxParamsLen = 63 - prefix.length - 1; // 28 chars max
  const safeParams = paramsStr.slice(0, Math.max(0, maxParamsLen));
  return `${prefix}:${safeParams}`;
}

/** Reconstructs UUID from 32-hex actionId in callback_data. */
function parseCallbackActionId(rawHex: string): string {
  if (rawHex.length !== 32) return rawHex;
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-${rawHex.slice(12, 16)}-${rawHex.slice(16, 20)}-${rawHex.slice(20)}`;
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
  const secretToken = typeof settings.telegramSecretToken === "string" ? settings.telegramSecretToken : null;

  if (!token || !enabled) {
    return new Response("Telegram bot is not configured or disabled for this agent.", {
      status: 400,
    });
  }

  // Webhook security: verify secret_token if configured
  if (secretToken) {
    const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== secretToken) {
      return new Response("Unauthorized webhook request.", { status: 401 });
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OpenRouter key not configured.", { status: 503 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return new Response("Invalid payload", { status: 400 });

  // Handle Telegram Callback Query (Action Confirmation Button Click)
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data ?? "";
    const chatId = cb.message?.chat.id;
    const messageId = cb.message?.message_id;

    if ((!data.startsWith("a:") && !data.startsWith("run_action:")) || !chatId || !messageId) {
      await answerTelegramCallbackQuery(token, cb.id);
      return new Response("OK", { status: 200 });
    }

    let actionId: string;
    let paramsStr: string;

    if (data.startsWith("a:")) {
      const parts = data.slice(2).split(":");
      actionId = parseCallbackActionId(parts[0] ?? "");
      paramsStr = parts.slice(1).join(":");
    } else {
      const parts = data.split(":");
      actionId = parts[1] ?? "";
      paramsStr = parts.slice(2).join(":");
    }

    await answerTelegramCallbackQuery(token, cb.id, "Running action...");

    const check = await getEnabledActionForPublicKey(publicKey, actionId);
    if (!check.ok) {
      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `❌ Action failed: ${check.error}`,
      );
      return new Response("OK", { status: 200 });
    }

    let parsedParams: Record<string, unknown> | undefined;
    if (paramsStr) {
      try {
        parsedParams = JSON.parse(paramsStr);
      } catch {
        parsedParams = { value: paramsStr };
      }
    }

    const res = await runProductAction({
      actionId: check.actionId,
      params: parsedParams ?? paramsStr,
    });

    if (res.ok) {
      const output = res.body ? `\n\n\`\`\`\n${res.body.slice(0, 1500)}\n\`\`\`` : "";
      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `✅ Action executed successfully!${output}`,
        { parseMode: "Markdown" },
      );
    } else {
      await editTelegramMessageText(
        token,
        chatId,
        messageId,
        `❌ Action failed: ${res.error ?? "Unknown error"}`,
      );
    }

    return new Response("OK", { status: 200 });
  }

  // Handle incoming message
  const msg = update.message;
  if (!msg || !msg.text || msg.from?.is_bot) {
    return new Response("OK", { status: 200 });
  }

  const chatId = msg.chat.id;
  const userText = msg.text.trim();

  if (!allowRequest(`${publicKey}:${chatId}`)) {
    await sendTelegramMessage(token, chatId, "Too many requests. Please wait a minute.");
    return new Response("OK", { status: 200 });
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
    { role: "user", content: userText.slice(0, 4000) },
  ];

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "HTTP-Referer": "https://taelprotocol.xyz",
          "X-Title": "Tael Telegram Agent",
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
        await sendTelegramMessage(
          token,
          chatId,
          "No response received from the agent.",
        );
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
          const paramsStr = args.params != null ? String(args.params) : "";
          const callbackData = buildCallbackData(action.id, paramsStr);

          await sendTelegramMessage(token, chatId, proposed.reply, {
            replyMarkup: {
              inline_keyboard: [
                [
                  {
                    text: `▶ Run ${action.name}`,
                    callback_data: callbackData,
                  },
                ],
              ],
            },
          });
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
        await sendTelegramMessage(token, chatId, text, { parseMode: "Markdown" });
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
    await sendTelegramMessage(
      token,
      chatId,
      "An error occurred while processing your request.",
    );
    return new Response("OK", { status: 200 });
  }
}
