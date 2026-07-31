import { getProductByPublicKey } from "../../../../../../features/products/queries";
import {
  getEnabledActionForPublicKey,
  runProductAction,
} from "../../../../../../features/products/run-product-action";
import { createRateLimiter } from "../../../../../../features/products/widget-chat";

// Public confirm-gated action runner for the widget. Chat only proposes; this
// endpoint runs after the visitor (or Test preview) confirms.
export const runtime = "nodejs";
export const maxDuration = 60;

const allowRequest = createRateLimiter(20, 60_000);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

interface RunBody {
  actionId?: string;
  /** Card that pays for capability runs (authenticated owner / Test). */
  agentId?: string;
  params?: string | Record<string, unknown>;
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

  const product = await getProductByPublicKey(publicKey);
  if (!product) return json({ error: "Agent not found." }, 404);

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  if (product.status !== "live" && !preview) {
    return json({ error: "Agent not found." }, 404);
  }

  const body = (await request.json().catch(() => null)) as RunBody | null;
  const actionId = body?.actionId?.trim();
  if (!actionId) return json({ error: "actionId is required." }, 400);

  const owned = await getEnabledActionForPublicKey(publicKey, actionId);
  if (!owned.ok) return json({ error: owned.error }, 404);

  const result = await runProductAction({
    actionId: owned.actionId,
    agentId: body?.agentId,
    params: body?.params,
  });

  if (!result.ok) {
    return json(
      {
        ok: false,
        error: result.error ?? "Could not run the action.",
        status: result.status,
        body: result.body,
      },
      result.error === "Not signed in." || result.error === "Not allowed." ? 401 : 400,
    );
  }

  return json({
    ok: true,
    status: result.status,
    body: result.body,
    paid: result.paid,
    txHash: result.txHash,
  });
}
