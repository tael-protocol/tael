"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, productContent, products } from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";
import type { ActionResult } from "./actions";
import { extractTitle, htmlToText, MAX_BODY_BYTES } from "./html-to-text";

const FETCH_TIMEOUT_MS = 15_000;

const contentTypeSchema = z.enum(["doc", "snippet", "website", "faq"]);
const titleSchema = z.string().trim().min(1, "Title is required").max(200);
const bodySchema = z.string().trim().min(1, "Content is required").max(MAX_BODY_BYTES);
const sourceUrlSchema = z.string().url("Enter a valid URL").max(2000).optional();

/**
 * Basic SSRF guard: reject non-http(s) URLs and obviously-internal hosts.
 * Mirrors apps/api/src/modules/gateway/upstream.ts `isBlockedUrl`.
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

/**
 * Fetch a URL while re-validating every redirect hop against the SSRF guard, so
 * a public page cannot 302 us onto an internal host (cloud metadata, localhost).
 * Uses manual redirects and follows up to `maxHops` of them.
 */
async function fetchNoSsrf(startUrl: string, maxHops = 4): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= maxHops; hop += 1) {
    if (isBlockedUrl(current)) throw new Error("blocked");
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "TaelStudioBot/1.0 (+https://taelprotocol.xyz)",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

async function assertProductOwner(
  productId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: "Agent not found." };
  return { ok: true };
}

async function assertContentOwner(
  contentId: string,
  userId: string,
): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const [row] = await db
    .select({ id: productContent.id, productId: productContent.productId })
    .from(productContent)
    .innerJoin(products, eq(productContent.productId, products.id))
    .where(and(eq(productContent.id, contentId), eq(products.ownerId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: "Content not found." };
  return { ok: true, productId: row.productId };
}

function revalidateStudio(productId: string) {
  revalidatePath("/studio");
  revalidatePath(`/studio/${productId}`);
}

const addContentSchema = z.object({
  type: contentTypeSchema,
  title: titleSchema,
  body: bodySchema,
  sourceUrl: sourceUrlSchema,
});

/** Insert a content row for a product the signed-in user owns. */
export async function addContent(
  productId: string,
  input: {
    type: "doc" | "snippet" | "website" | "faq";
    title: string;
    body: string;
    sourceUrl?: string;
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = addContentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const owned = await assertProductOwner(productId, user.id);
  if (!owned.ok) return owned;

  try {
    const [row] = await db
      .insert(productContent)
      .values({
        productId,
        type: parsed.data.type,
        title: parsed.data.title,
        body: parsed.data.body,
        sourceUrl: parsed.data.sourceUrl ?? null,
      })
      .returning({ id: productContent.id });

    revalidateStudio(productId);
    return { ok: true, id: row!.id };
  } catch {
    return { ok: false, error: "Could not add content. Try again." };
  }
}

const updateContentSchema = z.object({
  title: titleSchema.optional(),
  body: bodySchema.optional(),
  sourceUrl: z.string().url("Enter a valid URL").max(2000).nullable().optional(),
});

/** Update a content row. Ownership-checked via product join. */
export async function updateContent(
  contentId: string,
  input: { title?: string; body?: string; sourceUrl?: string | null },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = updateContentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const owned = await assertContentOwner(contentId, user.id);
  if (!owned.ok) return owned;

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  try {
    await db.update(productContent).set(patch).where(eq(productContent.id, contentId));
    revalidateStudio(owned.productId);
    return { ok: true, id: contentId };
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** Delete a content row. Ownership-checked via product join. */
export async function deleteContent(contentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const owned = await assertContentOwner(contentId, user.id);
  if (!owned.ok) return owned;

  try {
    await db.delete(productContent).where(eq(productContent.id, contentId));
    revalidateStudio(owned.productId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete. Try again." };
  }
}

/** Enable or disable a content row. Ownership-checked via product join. */
export async function toggleContent(contentId: string, enabled: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const owned = await assertContentOwner(contentId, user.id);
  if (!owned.ok) return owned;

  try {
    await db.update(productContent).set({ enabled }).where(eq(productContent.id, contentId));
    revalidateStudio(owned.productId);
    return { ok: true, id: contentId };
  } catch {
    return { ok: false, error: "Could not update. Try again." };
  }
}

/**
 * Fetch a single page, extract readable text, and store it as website content.
 * multi-page crawl is a follow-up.
 */
export async function syncWebsite(productId: string, url: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = z.string().trim().url("Enter a valid URL").max(2000).safeParse(url);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid URL." };
  }

  if (isBlockedUrl(parsed.data)) {
    return { ok: false, error: "That URL cannot be synced." };
  }

  const owned = await assertProductOwner(productId, user.id);
  if (!owned.ok) return owned;

  let html: string;
  try {
    const res = await fetchNoSsrf(parsed.data);
    if (!res.ok) {
      return { ok: false, error: `Could not fetch the page (${res.status}).` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      return { ok: false, error: "URL did not return an HTML page." };
    }
    // Cap the download before parsing so a huge response can't blow memory.
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES * 4) {
      return { ok: false, error: "Page is too large to sync." };
    }
    html = new TextDecoder("utf-8").decode(buf);
  } catch {
    return { ok: false, error: "Could not reach that URL. Try again." };
  }

  const hostname = new URL(parsed.data).hostname;
  const title = extractTitle(html, hostname);
  const body = htmlToText(html);
  if (!body) {
    return { ok: false, error: "No readable text found on that page." };
  }

  try {
    const [row] = await db
      .insert(productContent)
      .values({
        productId,
        type: "website",
        title,
        body,
        sourceUrl: parsed.data,
      })
      .returning({ id: productContent.id });

    revalidateStudio(productId);
    return { ok: true, id: row!.id };
  } catch {
    return { ok: false, error: "Could not save the synced page. Try again." };
  }
}
