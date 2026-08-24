"use server";

import { and, eq, productActions, products } from "@tael/database";
import { db } from "../../lib/db";
import { runCapability, type RunResult } from "../agents/run-capability";
import { getCurrentUser } from "../capabilities/current-user";

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Basic SSRF guard: reject non-http(s) URLs and obviously-internal hosts.
 * Mirrors content-actions.ts / apps/api gateway upstream.
 */
function isBlockedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname;
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export interface RunProductActionResult {
  ok: boolean;
  status?: number;
  body?: string;
  paid?: string;
  txHash?: string;
  error?: string;
}

/**
 * Execute a product action after the user confirmed it.
 * - capability → reuses runCapability (signed-in owner + Card pays)
 * - http → SSRF-guarded fetch (minimal stub for Stage 1)
 */
export async function runProductAction(input: {
  actionId: string;
  /** Required for capability actions: the Card that pays. */
  agentId?: string;
  /** Params from the confirm proposal. */
  params?: string | Record<string, unknown>;
  /**
   * When set (Telegram/Discord channel link), pay as this user instead of
   * requiring the product owner session.
   */
  payerUserId?: string;
}): Promise<RunProductActionResult> {
  const [row] = await db
    .select({
      id: productActions.id,
      kind: productActions.kind,
      config: productActions.config,
      enabled: productActions.enabled,
      productId: productActions.productId,
      ownerId: products.ownerId,
      status: products.status,
    })
    .from(productActions)
    .innerJoin(products, eq(productActions.productId, products.id))
    .where(eq(productActions.id, input.actionId))
    .limit(1);

  if (!row || !row.enabled) return { ok: false, error: "Action not found." };

  if (row.kind === "capability") {
    let payerUserId: string;
    let agentId = input.agentId;

    if (input.payerUserId) {
      payerUserId = input.payerUserId;
      if (!agentId) {
        return { ok: false, error: "No Card linked. Send /connect in this bot first." };
      }
    } else {
      const user = await getCurrentUser();
      if (!user) return { ok: false, error: "Not signed in." };
      if (user.id !== row.ownerId) return { ok: false, error: "Not allowed." };
      payerUserId = user.id;
      if (!agentId) return { ok: false, error: "Pick a Card to pay for this run." };
    }

    const slug = "slug" in row.config ? row.config.slug : "";
    if (!slug) return { ok: false, error: "Action is misconfigured." };

    const paramsStr =
      typeof input.params === "string"
        ? input.params
        : input.params
          ? JSON.stringify(input.params)
          : undefined;
    const looksJson = !!paramsStr?.trim().startsWith("{");
    // Default to GET with query; JSON body → POST.
    const method = looksJson ? "POST" : "GET";
    const result: RunResult = await runCapability({
      agentId,
      slug,
      method,
      body: looksJson ? paramsStr : undefined,
      query: !looksJson ? paramsStr : undefined,
      ownerId: payerUserId,
    });
    return {
      ok: result.ok,
      status: result.status,
      body: result.body,
      paid: result.paid,
      txHash: result.txHash,
      error: result.error,
    };
  }

  // HTTP: SSRF-guarded fetch. Stage 1 stub: returns status + clipped body.
  const url = "url" in row.config ? row.config.url : "";
  const method = ("url" in row.config ? row.config.method : "POST").toUpperCase();
  if (!url || isBlockedUrl(url)) {
    return { ok: false, error: "That URL cannot be called." };
  }

  try {
    const hasBody = method !== "GET" && method !== "HEAD";
    const bodyInit =
      hasBody && input.params
        ? {
            body: typeof input.params === "string" ? input.params : JSON.stringify(input.params),
            headers: { "content-type": "application/json" },
          }
        : {};

    const res = await fetch(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      ...bodyInit,
    });
    const text = await res.text();
    const clipped = text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body: clipped,
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, body: clipped };
  } catch {
    return { ok: false, error: "Could not reach that URL." };
  }
}

/**
 * Resolve an enabled action that belongs to the product identified by publicKey.
 * Used by the public widget run endpoint before calling runProductAction.
 */
export async function getEnabledActionForPublicKey(
  publicKey: string,
  actionId: string,
): Promise<{ ok: true; actionId: string } | { ok: false; error: string }> {
  const key = publicKey.trim();
  if (!key) return { ok: false, error: "Missing public key." };

  const [row] = await db
    .select({ id: productActions.id })
    .from(productActions)
    .innerJoin(products, eq(productActions.productId, products.id))
    .where(
      and(
        eq(productActions.id, actionId),
        eq(products.publicKey, key),
        eq(productActions.enabled, true),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, error: "Action not found." };
  return { ok: true, actionId: row.id };
}
