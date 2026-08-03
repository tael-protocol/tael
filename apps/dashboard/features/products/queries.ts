import "server-only";
import { randomBytes } from "node:crypto";
import {
  and,
  desc,
  eq,
  ilike,
  productActions,
  productContent,
  products,
  type Product,
  type ProductAction,
  type ProductContent,
} from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";

/** Build a URL-safe slug from a name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  const fallback = base || "agent";
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(ilike(products.slug, `${fallback}%`));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(fallback)) return fallback;
  for (let i = 2; ; i += 1) {
    const candidate = `${fallback}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function generatePublicKey(): string {
  return `tael_pub_${randomBytes(12).toString("hex")}`;
}

/** Default display name for a newly auto-created agent. */
function defaultAgentName(displayName: string | null, walletAddress: string): string {
  const named = displayName?.trim();
  if (named) return named.slice(0, 80);
  if (walletAddress.length > 10) {
    return `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;
  }
  return "My Agent";
}

/**
 * The signed-in user's single product agent. Creates one on first visit
 * (name from displayName / wallet handle, or "My Agent").
 */
export async function getOrCreateProduct(): Promise<Product | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const existing = await db
    .select()
    .from(products)
    .where(eq(products.ownerId, user.id))
    .orderBy(desc(products.createdAt))
    .limit(1);
  if (existing[0]) return existing[0];

  const name = defaultAgentName(user.displayName, user.walletAddress);
  try {
    const slug = await uniqueSlug(slugify(name));
    const publicKey = generatePublicKey();
    const [row] = await db
      .insert(products)
      .values({ ownerId: user.id, name, slug, publicKey })
      .returning();
    return row ?? null;
  } catch {
    // Race: another request created one first. Re-read.
    const again = await db
      .select()
      .from(products)
      .where(eq(products.ownerId, user.id))
      .orderBy(desc(products.createdAt))
      .limit(1);
    return again[0] ?? null;
  }
}

/** Load a single product owned by the current user. Returns null if missing. */
export async function getProduct(id: string): Promise<Product | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.ownerId, user.id)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List content for a product the signed-in user owns, newest first.
 * Returns [] when the product is missing or not owned.
 */
export async function listContent(productId: string): Promise<ProductContent[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [owned] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, user.id)))
    .limit(1);
  if (!owned) return [];

  return db
    .select()
    .from(productContent)
    .where(eq(productContent.productId, productId))
    .orderBy(desc(productContent.createdAt));
}

/**
 * List actions for a product the signed-in user owns, newest first.
 * Returns [] when the product is missing or not owned.
 */
export async function listActions(productId: string): Promise<ProductAction[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [owned] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, user.id)))
    .limit(1);
  if (!owned) return [];

  return db
    .select()
    .from(productActions)
    .where(eq(productActions.productId, productId))
    .orderBy(desc(productActions.createdAt));
}

/**
 * Public lookup by embed key. Used by the widget chat endpoint.
 * Returns the full row for server use; never serialize owner fields to clients.
 */
export async function getProductByPublicKey(publicKey: string): Promise<Product | null> {
  const key = publicKey.trim();
  if (!key) return null;
  const rows = await db.select().from(products).where(eq(products.publicKey, key)).limit(1);
  return rows[0] ?? null;
}

/**
 * Enabled content for a product, for chat grounding. Not owner-scoped: callers
 * must already have resolved a public (or preview) product.
 */
export async function getProductContentForChat(productId: string): Promise<ProductContent[]> {
  return db
    .select()
    .from(productContent)
    .where(and(eq(productContent.productId, productId), eq(productContent.enabled, true)))
    .orderBy(desc(productContent.createdAt));
}

/**
 * Enabled actions for a product, for chat tool calling. Not owner-scoped: callers
 * must already have resolved a public (or preview) product.
 */
export async function getProductActionsForChat(productId: string): Promise<ProductAction[]> {
  return db
    .select()
    .from(productActions)
    .where(and(eq(productActions.productId, productId), eq(productActions.enabled, true)))
    .orderBy(desc(productActions.createdAt));
}
