/**
 * Pure helpers for invoking a product capability action
 * (slug/operation parsing + param → GET query / POST body).
 */

export interface CapabilityRef {
  slug: string;
  operation?: string;
}

export interface CapabilityRequest {
  method: "GET" | "POST";
  query?: string;
  body?: string;
}

/**
 * Resolve capability path pieces from product action config.
 * Accepts either `{ slug: "stellar", operation: "pay" }` or combined
 * `{ slug: "stellar/pay" }` (legacy Studio entries).
 */
export function resolveCapabilityRef(config: {
  slug: string;
  operation?: string;
}): CapabilityRef {
  const rawSlug = config.slug.trim().replace(/^\/+|\/+$/g, "");
  const op = config.operation?.trim();
  if (op) {
    return { slug: rawSlug.split("/")[0] || rawSlug, operation: op.replace(/^\/+/, "") };
  }
  const slash = rawSlug.indexOf("/");
  if (slash === -1) return { slug: rawSlug };
  return {
    slug: rawSlug.slice(0, slash),
    operation: rawSlug.slice(slash + 1).replace(/^\/+/, "") || undefined,
  };
}

function isFlatPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Flat object of primitives → URLSearchParams query string. */
export function flatObjectToQuery(obj: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    qs.set(key, String(value));
  }
  return qs.toString();
}

/**
 * Map model/tool params into a capability HTTP call.
 * Flat JSON like `{ to, amount }` becomes GET `to=…&amount=…` (Pay/Swap style).
 * Nested objects stay POST JSON. Raw query strings stay GET.
 */
export function toCapabilityRequest(
  params?: string | Record<string, unknown> | null,
): CapabilityRequest {
  if (params == null) return { method: "GET" };

  if (typeof params === "string") {
    const trimmed = params.trim();
    if (!trimmed) return { method: "GET" };
    if (trimmed.startsWith("{")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return toCapabilityRequest(parsed as Record<string, unknown>);
        }
      } catch {
        return { method: "GET", query: trimmed.replace(/^\?/, "") };
      }
      return { method: "POST", body: trimmed };
    }
    return { method: "GET", query: trimmed.replace(/^\?/, "") };
  }

  const entries = Object.entries(params);
  if (entries.length === 0) return { method: "GET" };

  const allFlat = entries.every(([, value]) => isFlatPrimitive(value));
  if (allFlat) {
    const query = flatObjectToQuery(params);
    return query ? { method: "GET", query } : { method: "GET" };
  }

  return { method: "POST", body: JSON.stringify(params) };
}
