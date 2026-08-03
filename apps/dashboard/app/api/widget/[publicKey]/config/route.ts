import { getProductByPublicKey } from "../../../../../features/products/queries";
import { createRateLimiter } from "../../../../../features/products/widget-chat";

// Public branding config for the embed widget. Returns only safe display fields
// (no ownerId or other private data).
export const runtime = "nodejs";

const allowRequest = createRateLimiter(60, 60_000);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

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
        "cache-control": "public, max-age=60",
      },
    }),
  );
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function GET(request: Request, context: { params: Promise<{ publicKey: string }> }) {
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

  return json({
    name: product.name,
    greeting: product.greeting,
    brandColor: product.brandColor,
    logoUrl: product.logoUrl,
  });
}
