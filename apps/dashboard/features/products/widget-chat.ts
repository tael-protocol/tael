import type { Product, ProductContent } from "@tael/database";

/** Soft cap on concatenated knowledge so the system prompt stays bounded. */
export const CONTENT_BUDGET_CHARS = 12_000;

/**
 * Build the system prompt for a product widget agent from its config + enabled
 * content. Instructs the model to stay grounded and admit when it does not know.
 */
export function buildWidgetSystemPrompt(product: Product, content: ProductContent[]): string {
  const knowledge = formatContentForPrompt(content, CONTENT_BUDGET_CHARS);
  const description = product.description.trim();
  const greeting = product.greeting.trim();

  const parts = [
    `You are the on-site assistant for ${product.name}.`,
    description ? `About this product: ${description}` : null,
    greeting
      ? `When starting a conversation, you may greet users in this spirit: "${greeting}"`
      : null,
    "",
    "Answer using only the product knowledge below. If the answer is not in that knowledge, say you do not know based on the information you have. Do not invent facts, prices, or policies. Keep replies concise and helpful.",
    "",
    "## Product knowledge",
    knowledge || "(No content has been added yet. Say you do not have product information yet.)",
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
