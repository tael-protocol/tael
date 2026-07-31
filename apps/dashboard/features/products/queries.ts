import "server-only";
import { and, desc, eq, products, type Product } from "@tael/database";
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
