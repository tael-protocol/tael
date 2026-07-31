"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, ilike, products } from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";

const nameSchema = z.string().trim().min(1, "Name is required").max(80);
const brandColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #156DFC");
const greetingSchema = z.string().max(500);
const descriptionSchema = z.string().max(1000);
const statusSchema = z.enum(["draft", "live"]);

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/** Build a URL-safe slug from a name (the action makes it unique on collision). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Turn a base slug into a unique one. Returns the clean name when free;
 * falls back to `name-2`, `name-3`, … on collision.
 */
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

/** Stripe-style publishable key: `tael_pub_` + 24 hex chars. */
function generatePublicKey(): string {
  return `tael_pub_${randomBytes(12).toString("hex")}`;
}

const createProductSchema = z.object({
  name: nameSchema,
});

/**
 * Create a product agent for the signed-in user. Generates a unique slug from
 * the name and a random publicKey safe to expose in the embed snippet.
 */
export async function createProduct(input: { name: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const slug = await uniqueSlug(slugify(parsed.data.name));
  const publicKey = generatePublicKey();

  try {
    const [row] = await db
      .insert(products)
      .values({
        ownerId: user.id,
        name: parsed.data.name,
        slug,
        publicKey,
      })
      .returning({ id: products.id });

    revalidatePath("/studio");
    return { ok: true, id: row!.id };
  } catch {
    return { ok: false, error: "Could not create the agent. Try again." };
  }
}

const updateProductSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  brandColor: brandColorSchema.optional(),
  greeting: greetingSchema.optional(),
  status: statusSchema.optional(),
  logoUrl: z.string().max(200_000).nullable().optional(),
});

/** Update product settings. Ownership-checked. */
export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  try {
    const result = await db
      .update(products)
      .set(patch)
      .where(and(eq(products.id, id), eq(products.ownerId, user.id)))
      .returning({ id: products.id });

    if (!result[0]) return { ok: false, error: "Agent not found." };

    revalidatePath("/studio");
    revalidatePath(`/studio/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** Delete a product the signed-in user owns. Cascades content + actions. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.ownerId, user.id)))
      .returning({ id: products.id });

    if (!result[0]) return { ok: false, error: "Agent not found." };

    revalidatePath("/studio");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete. Try again." };
  }
}
