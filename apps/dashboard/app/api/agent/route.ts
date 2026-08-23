import { DASHBOARD_SYSTEM_PROMPT } from "../../../features/agent/knowledge";
import type { ProposedAction } from "../../../features/agent/types";
import { listAgentWallets } from "../../../features/agents/queries";
import {
  getPublicCapabilityBySlug,
  listMyCapabilities,
  listPublicCapabilities,
} from "../../../features/capabilities/queries";
import { getPaymentsData } from "../../../features/payments/queries";
import { getWalletOverview } from "../../../features/wallet/queries";
import { createLlmChatCompletion, getLlmConfig } from "../../../lib/llm";

// The dashboard's Tael copilot. It runs a tool loop over the same server queries
// the pages use (scoped to the signed-in user's session), so it answers with the
// account's real, live data. It can also PROPOSE running a capability — that
// never runs on its own; it returns a confirmation the user approves before a
// card pays. Talks to Gemini direct (with OpenRouter fallback). Node runtime:
// reads a server-only key and touches server-only queries.
export const runtime = "nodejs";
// The tool loop makes several model calls; give it room so multi-step asks
// (e.g. "run the TrustLine capability") don't hit the default function timeout.
export const maxDuration = 60;

const MAX_TOKENS = 700;
// Cap the tool loop so a confused model can never spin forever.
const MAX_TOOL_HOPS = 5;

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}
/** A multimodal content part (text or an image data URL), for attached blocks. */
type ContentPart =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
interface ChatMessage {
  role: string;
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
interface OpenRouterResponse {
  choices?: { message?: ChatMessage }[];
}

const TOOLS = [
  fn("get_wallet_overview", "The user's wallet balance, total spend, and revenue."),
  fn("list_cards", "The user's Cards (agent wallets) with their live USDC balances and caps."),
  fn("list_my_capabilities", "Capabilities the user has published: name, slug, price, status."),
  fn("browse_marketplace", "Capabilities available to buy in the marketplace."),
  fn("get_recent_payments", "The user's recent settled payments (incoming and outgoing)."),
  fn("get_capability", "Details of one capability by its slug (name, operations, prices).", {
    slug: { type: "string", description: "The capability's URL slug." },
  }),
  fn(
    "run_capability",
    "Propose running ONE operation of a capability for the user. This does NOT run immediately: it returns a confirmation the user must approve before their card pays. Call it only once you know the capability slug and which operation to run.",
    {
      slug: { type: "string", description: "The capability's URL slug." },
      operation: { type: "string", description: "The operation to run (its slug or name)." },
      params: {
        type: "string",
        description:
          "The op's parameters, formatted exactly like its `sample` field. For action ops (e.g. Stellar 'pay' or 'swap') this is required — pass every key the sample shows, e.g. `to=G…&amount=1.5`. Ask the user for any value you don't have (like the destination address or amount) before proposing the run.",
      },
      delaySeconds: {
        type: "string",
        description:
          "Optional. To SCHEDULE the run for later (e.g. 'pay ... in 2 minutes'), the number of seconds to wait before it runs. Max 300 (5 minutes). Omit to run now.",
      },
    },
    ["slug", "operation"],
  ),
  fn(
    "create_card",
    "Propose creating a new Card (an agent's funded Stellar wallet). Does NOT create it immediately: the user confirms first. Use when the user asks to create/make a card or wallet.",
    { name: { type: "string", description: "A name for the card, e.g. 'Research'." } },
  ),
  fn(
    "create_api_key",
    "Propose creating an API key, optionally linked to one of the user's Cards so the key can spend. Does NOT create it immediately: the user confirms first, and the key is shown only once. Use when the user asks to create an API key, or 'an api with <card>'.",
    {
      name: { type: "string", description: "A name for the key." },
      card: { type: "string", description: "Optional Card name to link the key to." },
    },
  ),
];

function fn(
  name: string,
  description: string,
  properties?: Record<string, unknown>,
  required?: string[],
) {
  return {
    type: "function" as const,
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties: properties ?? {},
        required: required ?? (properties ? Object.keys(properties) : []),
      },
    },
  };
}

function clip(s: string, n = 4000): string {
  return s.length > n ? `${s.slice(0, n)}… (truncated)` : s;
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Trim a capability to what the model needs to find + run it, so the whole
 *  marketplace fits in one tool result instead of being clipped after the first. */
function compactCap(c: Awaited<ReturnType<typeof listPublicCapabilities>>[number]) {
  return {
    name: c.name,
    slug: c.slug,
    kind: c.kind,
    price: c.price,
    status: c.status,
    operations: c.spec?.operations?.map((o) => ({
      name: o.name,
      slug: o.slug ?? kebab(o.name),
      price: o.price,
      method: o.method ?? "GET",
      // How params are shaped for this op (e.g. `to=G…&amount=1.5`) so the model
      // fills them correctly when it proposes a run.
      sample: o.sampleRequest,
    })),
    description: c.description ? c.description.slice(0, 140) : undefined,
  };
}

/** Read-only tools return live data for the signed-in user, as compact JSON. */
async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "get_wallet_overview":
        return clip(JSON.stringify(await getWalletOverview()));
      case "list_cards":
        return clip(JSON.stringify(await listAgentWallets()));
      case "list_my_capabilities":
        return clip(JSON.stringify((await listMyCapabilities()).map(compactCap)));
      case "browse_marketplace":
        return clip(JSON.stringify((await listPublicCapabilities()).map(compactCap)));
      case "get_recent_payments":
        return clip(JSON.stringify(await getPaymentsData()));
      case "get_capability": {
        const slug = String(args.slug ?? "").trim();
        if (!slug) return JSON.stringify({ error: "slug is required" });
        return clip(
          JSON.stringify((await getPublicCapabilityBySlug(slug)) ?? { error: "not found" }),
        );
      }
      default:
        return JSON.stringify({ error: `unknown tool: ${name}` });
    }
  } catch (error) {
    console.error(`[copilot] tool ${name} failed:`, error);
    return JSON.stringify({ error: "that lookup failed" });
  }
}

// Tael's action fee, mirrored from the settlement path so the preview cost here
// matches what the card is actually charged (avoids "it's free" then a cap fail).
const ACTION_FEE_BPS = Number(process.env.TAEL_ACTION_FEE_BPS ?? "100");
const ACTION_FEE_RATE =
  process.env.TAEL_FEE_ADDRESS && ACTION_FEE_BPS > 0 ? ACTION_FEE_BPS / 1e4 : 0;

/** Read one param out of a run's params, whether the model formatted them as a
 *  query string (`to=G…&amount=1`) or JSON (`{"to":"G…","amount":"1"}`). */
function paramValue(params: string | undefined, key: string): string | null {
  const s = params?.trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const v = (JSON.parse(s) as Record<string, unknown>)[key];
      return v == null ? null : String(v);
    } catch {
      return null;
    }
  }
  return new URLSearchParams(s.replace(/^\?/, "")).get(key);
}

/** The positive `amount` a run sends, or null if absent/invalid. */
function amountFromParams(params: string | undefined): number | null {
  const n = Number(paramValue(params, "amount"));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A short, human number: no trailing zeros, capped at USDC's 7 decimals. */
function trimNum(n: number): string {
  return String(Number(n.toFixed(7)));
}

/**
 * Resolve a proposed run: price it by what the card is REALLY charged (an
 * on-chain action moves the amount sent + fee, not the op's free call price),
 * pick a card that can actually afford it, then return a confirm proposal.
 * Running is still enforced by the card's on-chain caps + the gateway price when
 * the user approves, so this only needs to be a good-faith preview.
 */
async function proposeRun(
  args: Record<string, unknown>,
): Promise<{ reply: string; action: ProposedAction | null }> {
  const slug = String(args.slug ?? "").trim();
  const opRef = String(args.operation ?? "").trim();
  const params = args.params ? String(args.params) : undefined;
  if (!slug) return { reply: "I need the capability's slug to run it.", action: null };

  const cap = await getPublicCapabilityBySlug(slug);
  if (!cap) return { reply: `I couldn't find a capability with slug "${slug}".`, action: null };

  const ops = cap.spec?.operations ?? [];
  const op =
    ops.find(
      (o) => (o.slug ?? kebab(o.name)) === opRef || o.name.toLowerCase() === opRef.toLowerCase(),
    ) ?? ops[0];
  if (!op) return { reply: `${cap.name} has no runnable operations.`, action: null };

  // Optional schedule: run this many seconds from confirmation (client-side, so
  // capped at 5 minutes and only while the tab stays open).
  const delaySeconds = Math.max(0, Math.round(Number(args.delaySeconds ?? 0)) || 0);
  if (delaySeconds > 300) {
    return {
      reply:
        "I can only schedule a payment up to 5 minutes out for now (it runs while this tab stays open). Want it within 5 minutes, or should I send it now?",
      action: null,
    };
  }

  const price = op.price ?? "0";
  // On-chain ACTION ops (Stellar pay/swap) move the amount the user names plus
  // Tael's fee — not the op's (free) call price. Detect them by their
  // `tael_action` sample response and price the run by that real spend.
  const isAction = /tael_action/.test(op.sampleResponse ?? "");
  const sendAmount = isAction ? amountFromParams(params) : null;

  // An action with no amount (or a pay with no destination) isn't runnable — ask
  // for the missing value instead of proposing a run that would just fail.
  if (isAction) {
    const needsTo = /(^|[?&{"\s])to[=:]/.test(op.sampleRequest ?? "to=");
    const hasTo = params ? /(^|[?&{"\s])to[=:]/.test(params) : false;
    if (sendAmount == null || (needsTo && !hasTo)) {
      return {
        reply: `To run **${op.name}** I need the amount${needsTo ? " and the destination address" : ""}. Tell me, e.g. "pay 0.5 USDC to G…", and I'll set it up.`,
        action: null,
      };
    }
  }
  // The per-call spend the card must cover (cap + balance).
  const spend =
    sendAmount != null ? Number((sendAmount * (1 + ACTION_FEE_RATE)).toFixed(7)) : Number(price);

  const cards = await listAgentWallets();
  if (cards.length === 0) {
    return {
      reply: `You don't have a card set up yet — create one under Cards first.`,
      action: null,
    };
  }
  const withinCap = cards.filter((c) => !c.policy || spend <= Number(c.policy.maxPerCall));
  const card = withinCap.find((c) => Number(c.usdc) >= spend);

  if (!card) {
    // Nothing can run it — say why, specifically, and how to fix it.
    if (withinCap.length === 0) {
      const maxCap = Math.max(...cards.map((c) => Number(c.policy?.maxPerCall ?? 0)));
      return {
        reply:
          sendAmount != null
            ? `Sending $${trimNum(sendAmount)} USDC costs about $${trimNum(spend)} per call (incl. fee), but your highest per-call cap is $${trimNum(maxCap)}. Raise a card's per-call limit in **Cards → (the card) → Settings**, then ask again — or send a smaller amount.`
            : `Running ${op.name} costs $${price} USDC, over every card's per-call cap ($${trimNum(maxCap)}). Raise a card's per-call limit first.`,
        action: null,
      };
    }
    const best = withinCap.reduce((a, b) => (Number(b.usdc) > Number(a.usdc) ? b : a));
    return {
      reply: `Your "${best.name}" card can run this, but it only holds $${best.usdc} USDC — it needs about $${trimNum(spend)}. Fund it, then ask again:\n\n\`${best.address}\``,
      action: null,
    };
  }

  const cost =
    sendAmount != null
      ? `sends **$${trimNum(sendAmount)} USDC**${ACTION_FEE_RATE > 0 ? " (plus a small network fee)" : ""} from your "${card.name}" card`
      : Number(price) > 0
        ? `pays **$${price} USDC** from your "${card.name}" card`
        : "is free";
  const when =
    delaySeconds > 0
      ? ` in ~${delaySeconds >= 60 ? `${Math.round(delaySeconds / 60)} min` : `${delaySeconds}s`}`
      : "";
  return {
    reply:
      delaySeconds > 0
        ? `I'll schedule **${op.name}** on ${cap.name}${when} — it ${cost}. Confirm below to schedule it.`
        : `I can run **${op.name}** on ${cap.name} — it ${cost}. Confirm below to run it.`,
    action: {
      kind: "run",
      slug,
      operation: op.slug ?? kebab(op.name),
      method: op.method ?? "GET",
      params,
      cardId: card.agentId,
      cardName: card.name,
      capabilityName: cap.name,
      operationName: op.name,
      // Show the true per-call cost on the confirm button (the amount + fee for
      // an action), not the op's free call price.
      price: sendAmount != null ? trimNum(spend) : price,
      // For a pay/swap, tell the confirm card what it sends + where, so it can
      // read "Send $1 USDC to G…" instead of just a bare amount.
      ...(sendAmount != null ? { sendAmount: trimNum(sendAmount) } : {}),
      ...(isAction && paramValue(params, "to") ? { sendTo: paramValue(params, "to")! } : {}),
      ...(delaySeconds > 0 ? { delaySeconds } : {}),
    },
  };
}

/** Propose creating a new Card (with sensible default limits). */
function proposeCreateCard(args: Record<string, unknown>): {
  reply: string;
  action: ProposedAction;
} {
  const name = String(args.name ?? "").trim() || "New Card";
  return {
    reply: `I'll create a Card called **${name}** with default limits ($0.10 per call, $5.00 daily). Confirm below.`,
    action: { kind: "create_card", name, maxPerCall: "0.10", dailyLimit: "5.00" },
  };
}

/** Propose creating an API key, resolving an optional Card by name. */
async function proposeCreateKey(
  args: Record<string, unknown>,
): Promise<{ reply: string; action: ProposedAction }> {
  const name = String(args.name ?? "").trim() || "API key";
  const cardRef = String(args.card ?? "").trim();
  let cardId: string | undefined;
  let cardName: string | undefined;
  if (cardRef) {
    const card = (await listAgentWallets()).find(
      (c) => c.name.toLowerCase() === cardRef.toLowerCase(),
    );
    if (card) {
      cardId = card.agentId;
      cardName = card.name;
    }
  }
  const link = cardName ? ` linked to your "${cardName}" card` : "";
  return {
    reply: `I'll create an API key named **${name}**${link}. You'll see the key only once, copy it right away. Confirm below.`,
    action: { kind: "create_api_key", name, cardId, cardName },
  };
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function reply(text: string, action: ProposedAction | null = null): Response {
  return new Response(JSON.stringify({ reply: text, action }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface AgentRequestBody {
  messages?: { role: "user" | "assistant"; content: string; attachments?: string[] }[];
  pageContext?: { path?: string };
}

export async function POST(request: Request) {
  const llm = getLlmConfig();
  if (!llm) return jsonError("The agent isn't configured yet (missing GEMINI_API_KEY).", 503);

  const body = (await request.json().catch(() => null)) as AgentRequestBody | null;
  const messages = body?.messages;
  if (!messages?.length || messages[messages.length - 1]?.role !== "user") {
    return jsonError("The last message must be from the user.", 400);
  }

  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const page = body?.pageContext?.path;
  const system =
    DASHBOARD_SYSTEM_PROMPT +
    `\n\n## This dashboard\nThis dashboard is running on Stellar **${network}**.` +
    (page ? ` The user is on: ${page}` : "") +
    `\n\nThe user can attach a screenshot of a block on this page. When one is attached, read it and answer about exactly what's shown.`;

  const convo: ChatMessage[] = [
    { role: "system", content: system },
    ...messages.slice(-20).map((m) => ({
      role: m.role,
      // A message with attached block screenshots becomes multimodal content so
      // the (vision) model can actually see what's on the user's screen.
      content: m.attachments?.length
        ? ([
            { type: "text", text: m.content || "(screenshot of a page block)" },
            ...m.attachments.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ] as ContentPart[])
        : m.content,
    })),
  ];

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop += 1) {
    let data: OpenRouterResponse;
    try {
      const resp = await createLlmChatCompletion(llm, {
        messages: convo,
        tools: TOOLS,
        maxTokens: MAX_TOKENS,
        title: "Tael Agent",
      });
      if (!resp.ok) {
        console.error(
          "[copilot] llm error:",
          llm.provider,
          resp.status,
          await resp.text().catch(() => ""),
        );
        return reply("Sorry, the agent is unavailable right now. Please try again.");
      }
      data = (await resp.json()) as OpenRouterResponse;
    } catch (error) {
      console.error("[copilot] llm request failed:", error);
      return reply("Sorry, something went wrong on my end. Please try again.");
    }

    const message = data.choices?.[0]?.message;
    if (!message) return reply("Sorry, I didn't get a response. Please try again.");

    if (message.tool_calls?.length) {
      // A write proposal is terminal: resolve it and return a confirm card.
      const run = message.tool_calls.find((c) => c.function.name === "run_capability");
      if (run) {
        const { reply: text, action } = await proposeRun(safeParseArgs(run.function.arguments));
        return reply(text, action);
      }
      const cc = message.tool_calls.find((c) => c.function.name === "create_card");
      if (cc) {
        const { reply: text, action } = proposeCreateCard(safeParseArgs(cc.function.arguments));
        return reply(text, action);
      }
      const ck = message.tool_calls.find((c) => c.function.name === "create_api_key");
      if (ck) {
        const { reply: text, action } = await proposeCreateKey(
          safeParseArgs(ck.function.arguments),
        );
        return reply(text, action);
      }
      // Otherwise run the read tools and loop with their results.
      convo.push(message);
      for (const call of message.tool_calls) {
        const out = await runTool(call.function.name, safeParseArgs(call.function.arguments));
        convo.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: out });
      }
      continue;
    }

    return reply(typeof message.content === "string" ? message.content : "");
  }

  return reply("I couldn't quite finish that — try rephrasing?");
}
