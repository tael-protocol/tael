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
export function resolveCapabilityRef(config: { slug: string; operation?: string }): CapabilityRef {
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

/** Stellar ops that require `address=` (or similar) and can default to the Card. */
const ADDRESS_OPS = new Set([
  "balance",
  "account",
  "payments",
  "portfolio",
  "effects",
  "offers",
  "claimable",
]);

/** True when this capability/operation typically needs a Stellar address. */
export function operationNeedsAddress(ref: CapabilityRef): boolean {
  const op = (ref.operation ?? "").split("/")[0]?.toLowerCase() ?? "";
  if (ADDRESS_OPS.has(op)) return true;
  // Combined legacy slug already split; also catch bare "balance" slug misuse.
  return ADDRESS_OPS.has(ref.slug.toLowerCase());
}

/** Whether a capability request already includes an address-like query param. */
export function requestHasAddress(call: CapabilityRequest): boolean {
  if (call.query) {
    const qs = new URLSearchParams(call.query.replace(/^\?/, ""));
    for (const key of ["address", "account", "claimant"]) {
      const v = qs.get(key)?.trim();
      if (v && v.length > 0) return true;
    }
  }
  if (call.body) {
    try {
      const parsed: unknown = JSON.parse(call.body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        for (const key of ["address", "account", "claimant"]) {
          if (typeof o[key] === "string" && o[key].trim()) return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * If the op needs an address and none was provided, default to the linked Card
 * address (Discord/Telegram "check my balance" UX).
 */
export function withDefaultCardAddress(
  call: CapabilityRequest,
  ref: CapabilityRef,
  cardAddress: string,
): CapabilityRequest {
  if (!operationNeedsAddress(ref) || requestHasAddress(call) || !cardAddress.trim()) {
    return call;
  }
  // Prefer GET query — balance/account/etc. are GET ops.
  if (call.method === "POST" && call.body) {
    try {
      const parsed: unknown = JSON.parse(call.body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          method: "POST",
          body: JSON.stringify({ ...(parsed as Record<string, unknown>), address: cardAddress }),
        };
      }
    } catch {
      // fall through to query
    }
  }
  const qs = new URLSearchParams(call.query?.replace(/^\?/, "") ?? "");
  qs.set("address", cardAddress);
  return { method: "GET", query: qs.toString() };
}
