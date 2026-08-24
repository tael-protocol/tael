import type { Product, ProductAction, ProductContent } from "@tael/database";

/** Soft cap on concatenated knowledge so the system prompt stays bounded. */
export const CONTENT_BUDGET_CHARS = 12_000;

/**
 * A product action the widget proposes. Mirrors the dashboard confirm-card
 * shape: the model never runs it; the client shows a confirm UI first.
 */
export type ProposedWidgetAction =
  | {
      kind: "capability";
      actionId: string;
      name: string;
      slug: string;
      /** Params the model filled (query string or JSON). */
      params?: string;
    }
  | {
      kind: "http";
      actionId: string;
      name: string;
      url: string;
      method: string;
      params?: Record<string, unknown>;
    };

/** OpenRouter-style tool definition built from a product action. */
export interface WidgetToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/** Stable tool name for an action id (UUID hyphens → underscores). */
export function toolNameForAction(actionId: string): string {
  return `run_action_${actionId.replace(/-/g, "_")}`;
}

/** Reverse of toolNameForAction; returns null if the name is not ours. */
export function actionIdFromToolName(name: string): string | null {
  if (!name.startsWith("run_action_")) return null;
  const raw = name.slice("run_action_".length);
  if (!/^[0-9a-f_]+$/i.test(raw)) return null;
  // UUID is 32 hex chars with underscores where hyphens were (8-4-4-4-12).
  const hex = raw.replace(/_/g, "");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Build OpenRouter tools from enabled product actions. */
export function buildWidgetTools(actions: ProductAction[]): WidgetToolDef[] {
  return actions.map((action) => {
    const properties: Record<string, unknown> = {
      params: {
        type: "string",
        description:
          action.kind === "http"
            ? "Optional JSON object of parameters to send with the HTTP request."
            : 'Parameters for the capability. Prefer a JSON object string like {"to":"G…","amount":"0.05"} for Pay, or {"address":"G…"} for Balance. If the user says "my balance" and has a linked Card, address can be omitted.',
      },
    };
    return {
      type: "function" as const,
      function: {
        name: toolNameForAction(action.id),
        description: `${action.name}: ${action.description}. This does NOT run immediately: it returns a confirmation the user must approve first.`,
        parameters: {
          type: "object",
          properties,
          required: [] as string[],
        },
      },
    };
  });
}

/**
 * Turn a tool call into a confirm-gated proposal. Never executes anything.
 */
export function proposeWidgetAction(
  action: ProductAction,
  args: Record<string, unknown>,
): { reply: string; action: ProposedWidgetAction } {
  const paramsRaw = args.params != null ? String(args.params) : undefined;
  const paramsTrimmed = paramsRaw?.trim() || undefined;

  if (action.kind === "capability") {
    const slug = "slug" in action.config ? action.config.slug : "";
    return {
      reply: `I can run **${action.name}**. Confirm below to run it.`,
      action: {
        kind: "capability",
        actionId: action.id,
        name: action.name,
        slug,
        ...(paramsTrimmed ? { params: paramsTrimmed } : {}),
      },
    };
  }

  const url = "url" in action.config ? action.config.url : "";
  const method = "url" in action.config ? action.config.method : "POST";
  let params: Record<string, unknown> | undefined;
  if (paramsTrimmed) {
    try {
      const parsed: unknown = JSON.parse(paramsTrimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        params = parsed as Record<string, unknown>;
      }
    } catch {
      params = { value: paramsTrimmed };
    }
  }

  return {
    reply: `I can run **${action.name}**. Confirm below to run it.`,
    action: {
      kind: "http",
      actionId: action.id,
      name: action.name,
      url,
      method,
      ...(params ? { params } : {}),
    },
  };
}

/**
 * Build the system prompt for a product widget agent from its config + enabled
 * content (+ optional actions). Instructs the model to stay grounded and to
 * propose actions via tools (never claim they already ran).
 */
export function buildWidgetSystemPrompt(
  product: Product,
  content: ProductContent[],
  actions: ProductAction[] = [],
  options?: {
    /** When false, never open with a greeting (Telegram mid-chat turns). */
    allowGreeting?: boolean;
  },
): string {
  const knowledge = formatContentForPrompt(content, CONTENT_BUDGET_CHARS);
  const description = product.description.trim();
  const greeting = product.greeting.trim();
  const allowGreeting = options?.allowGreeting !== false;

  const actionLines =
    actions.length > 0
      ? [
          "",
          "## Available actions",
          "You can propose ONLY the following product actions via tools when they clearly help the user. Do not invent other capabilities. Do not claim an action already ran: proposing returns a confirmation the user must approve first.",
          ...actions.map((a) => {
            const slug =
              a.kind === "capability" && "slug" in a.config
                ? a.config.operation
                  ? `${a.config.slug}/${a.config.operation}`
                  : a.config.slug
                : null;
            const suffix = slug ? ` [capability: ${slug}]` : "";
            return `- ${a.name} (${a.kind})${suffix}: ${a.description}`;
          }),
          "",
          'For capability actions that need inputs (e.g. Pay: destination + amount), put them in the tool `params` as a JSON object like {"to":"G…","amount":"0.05"} or as a query string to=G…&amount=0.05.',
        ]
      : [];

  const greetingLines = allowGreeting
    ? [
        greeting
          ? `Opening greeting (use ONLY on the very first reply in a new conversation, or when the user says /start). Do not repeat it on later messages. Spirit: "${greeting}"`
          : null,
        'Never start a reply with a canned greeting like "How can I help you?" unless this is the first message and that phrase is the configured opening greeting.',
      ]
    : [
        'This is a continuing conversation. Do NOT greet. Do NOT say hello, hi, or "How can I help you?". Answer the user\'s latest message directly.',
      ];

  const parts = [
    `You are the product assistant for ${product.name}. Speak as this product's own agent — helpful, concise, and on-brand — not as a generic marketplace or Stellar capability catalog.`,
    description ? `About this product: ${description}` : null,
    ...greetingLines,
    "",
    "Answer using only the product knowledge below. If the answer is not in that knowledge, say you do not know based on the information you have. Do not invent facts, prices, or policies.",
    "Do not dump Free/Priced/On-chain capability menus, marketplace listings, or unrelated Stellar operation catalogs unless the product knowledge explicitly contains that and the user asked for it.",
    "Keep replies concise. Prefer short sentences over bullet catalogs.",
    "",
    "## Product knowledge",
    knowledge || "(No content has been added yet. Say you do not have product information yet.)",
    ...actionLines,
  ];

  return parts.filter((p) => p !== null).join("\n");
}

function formatContentForPrompt(content: ProductContent[], budget: number): string {
  const chunks: string[] = [];
  let used = 0;

  for (const item of content) {
    const header = `### ${item.title} (${item.type})`;
    const body = item.body.trim();
    if (!body) continue;
    const block = `${header}\n${body}`;
    if (used + block.length + 2 > budget) {
      const remaining = budget - used - header.length - 3;
      if (remaining > 80) {
        chunks.push(`${header}\n${body.slice(0, remaining)}…`);
      }
      break;
    }
    chunks.push(block);
    used += block.length + 2;
  }

  return chunks.join("\n\n");
}

/** Simple per-key sliding window: max `limit` hits in the last `windowMs`. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return function allow(key: string): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const prev = hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
