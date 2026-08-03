import {
  getProductActionsForChat,
  getProductByPublicKey,
  getProductContentForChat,
} from "../../../../../features/products/queries";
import {
  actionIdFromToolName,
  buildWidgetSystemPrompt,
  buildWidgetTools,
  createRateLimiter,
  proposeWidgetAction,
  type ProposedWidgetAction,
} from "../../../../../features/products/widget-chat";

// Public per-product widget chat. Answers from that product's enabled content
// and can PROPOSE enabled actions (confirm-gated; never runs them here).
// No auth: the publicKey is the Stripe-style publishable key. Node runtime for
// the OpenRouter key; room for a short tool loop.
export const runtime = "nodejs";
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
const MAX_TOKENS = 700;
const MAX_MESSAGES = 20;
const MAX_TOOL_HOPS = 3;

const allowRequest = createRateLimiter(20, 60_000);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

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

interface WidgetChatBody {
  messages?: { role: string; content: string }[];
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }),
  );
}

function reply(text: string, action: ProposedWidgetAction | null = null): Response {
  return json({ reply: text, action });
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

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request, context: { params: Promise<{ publicKey: string }> }) {
  const { publicKey: rawKey } = await context.params;
  const publicKey = decodeURIComponent(rawKey ?? "").trim();
  if (!publicKey) return json({ error: "Missing public key." }, 400);

  if (!allowRequest(publicKey)) {
    return json({ error: "Too many requests. Try again in a minute." }, 429);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: "The agent is not configured yet." }, 503);
  }

  const product = await getProductByPublicKey(publicKey);
  if (!product) return json({ error: "Agent not found." }, 404);

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (product.status !== "live" && !preview) {
    return json({ error: "Agent not found." }, 404);
  }

  const body = (await request.json().catch(() => null)) as WidgetChatBody | null;
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages is required." }, 400);
  }

  const cleaned: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    if (typeof m.content !== "string" || !m.content.trim()) continue;
    cleaned.push({ role: m.role, content: m.content.trim().slice(0, 4000) });
  }
  if (cleaned.length === 0 || cleaned[cleaned.length - 1]?.role !== "user") {
    return json({ error: "The last message must be from the user." }, 400);
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
    ...cleaned.slice(-MAX_MESSAGES),
  ];

  try {
    for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
      const resp = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "HTTP-Referer": "https://taelprotocol.xyz",
          "X-Title": "Tael Widget Agent",
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
        return json({ error: "The agent is unavailable right now. Please try again." }, 502);
      }

      const data = (await resp.json()) as OpenRouterResponse;
      const message = data.choices?.[0]?.message;
      if (!message) {
        return json({ error: "No response from the agent. Please try again." }, 502);
      }

      if (message.tool_calls?.length) {
        // A write proposal is terminal: resolve the first matching action tool
        // and return a confirm card. Do not execute server-side.
        for (const call of message.tool_calls) {
          const actionId = actionIdFromToolName(call.function.name);
          if (!actionId) continue;
          const action = actionsById.get(actionId);
          if (!action) continue;
          const proposed = proposeWidgetAction(action, safeParseArgs(call.function.arguments));
          return reply(proposed.reply, proposed.action);
        }
        // Unknown tools: tell the model and continue (should be rare).
        convo.push(message);
        for (const call of message.tool_calls) {
          convo.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify({ error: "unknown or disabled action" }),
          });
        }
        continue;
      }

      const text = typeof message.content === "string" ? message.content.trim() : "";
      if (!text) {
        return json({ error: "No response from the agent. Please try again." }, 502);
      }
      return reply(text, null);
    }

    return reply("I couldn't quite finish that. Try rephrasing?");
  } catch {
    return json({ error: "Something went wrong. Please try again." }, 502);
  }
}
