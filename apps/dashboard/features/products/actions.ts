"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, products } from "@tael/database";
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

/** Revalidate every Studio page after a product mutation. */
export function revalidateStudioPaths() {
  revalidatePath("/studio");
  revalidatePath("/studio/train");
  revalidatePath("/studio/test");
  revalidatePath("/studio/deploy");
  revalidatePath("/studio/inbox");
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

    revalidateStudioPaths();
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

    revalidateStudioPaths();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete. Try again." };
  }
}
