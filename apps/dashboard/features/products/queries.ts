import "server-only";
import {
  and,
  desc,
  eq,
  productActions,
  productContent,
  products,
  type Product,
  type ProductAction,
  type ProductContent,
} from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";

/** List the signed-in user's products (agents), newest first. */
export async function listProducts(): Promise<Product[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return db
    .select()
    .from(products)
    .where(eq(products.ownerId, user.id))
    .orderBy(desc(products.createdAt));
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
