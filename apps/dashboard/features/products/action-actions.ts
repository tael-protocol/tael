"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, productActions, products } from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";
import type { ActionResult } from "./actions";

const nameSchema = z.string().trim().min(1, "Name is required").max(80);
const descriptionSchema = z.string().trim().min(1, "Description is required").max(1000);
const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const capabilityConfigSchema = z.object({
  slug: z.string().trim().min(1, "Capability slug is required").max(120),
});

const httpConfigSchema = z.object({
  url: z.string().trim().url("Enter a valid URL").max(2000),
  method: httpMethodSchema,
  paramsSchema: z.record(z.string(), z.unknown()).optional(),
});

const addActionSchema = z.discriminatedUnion("kind", [
  z.object({
    name: nameSchema,
    description: descriptionSchema,
    kind: z.literal("capability"),
    config: capabilityConfigSchema,
    shareAsCapability: z.boolean().optional(),
  }),
  z.object({
    name: nameSchema,
    description: descriptionSchema,
    kind: z.literal("http"),
    config: httpConfigSchema,
    shareAsCapability: z.boolean().optional(),
  }),
]);

const updateActionSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  shareAsCapability: z.boolean().optional(),
  config: z.union([capabilityConfigSchema, httpConfigSchema]).optional(),
});

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

async function assertActionOwner(
  actionId: string,
  userId: string,
): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const [row] = await db
    .select({ id: productActions.id, productId: productActions.productId })
    .from(productActions)
    .innerJoin(products, eq(productActions.productId, products.id))
    .where(and(eq(productActions.id, actionId), eq(products.ownerId, userId)))
    .limit(1);
  if (!row) return { ok: false, error: "Action not found." };
  return { ok: true, productId: row.productId };
}

function revalidateStudio(productId: string) {
  revalidatePath("/studio");
  revalidatePath(`/studio/${productId}`);
}

export type AddActionInput = z.infer<typeof addActionSchema>;

/** Insert an action for a product the signed-in user owns. */
export async function addAction(productId: string, input: AddActionInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = addActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const owned = await assertProductOwner(productId, user.id);
  if (!owned.ok) return owned;

  try {
    const [row] = await db
      .insert(productActions)
      .values({
        productId,
        name: parsed.data.name,
        description: parsed.data.description,
        kind: parsed.data.kind,
        config: parsed.data.config,
        shareAsCapability: parsed.data.shareAsCapability ?? false,
      })
      .returning({ id: productActions.id });

    revalidateStudio(productId);
    return { ok: true, id: row!.id };
  } catch {
    return { ok: false, error: "Could not add action. Try again." };
  }
}

/** Update an action. Ownership-checked via product join. */
export async function updateAction(
  actionId: string,
  input: z.infer<typeof updateActionSchema>,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = updateActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const owned = await assertActionOwner(actionId, user.id);
  if (!owned.ok) return owned;

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  // If config is patched, keep it aligned with the row's kind.
  if (patch.config) {
    const [existing] = await db
      .select({ kind: productActions.kind })
      .from(productActions)
      .where(eq(productActions.id, actionId))
      .limit(1);
    if (!existing) return { ok: false, error: "Action not found." };
    if (existing.kind === "capability") {
      const cfg = capabilityConfigSchema.safeParse(patch.config);
      if (!cfg.success) {
        return { ok: false, error: cfg.error.issues[0]?.message ?? "Invalid config." };
      }
      patch.config = cfg.data;
    } else {
      const cfg = httpConfigSchema.safeParse(patch.config);
      if (!cfg.success) {
        return { ok: false, error: cfg.error.issues[0]?.message ?? "Invalid config." };
      }
      patch.config = cfg.data;
    }
  }

  try {
    await db.update(productActions).set(patch).where(eq(productActions.id, actionId));
    revalidateStudio(owned.productId);
    return { ok: true, id: actionId };
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }
}

/** Delete an action. Ownership-checked via product join. */
export async function deleteAction(actionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const owned = await assertActionOwner(actionId, user.id);
  if (!owned.ok) return owned;

  try {
    await db.delete(productActions).where(eq(productActions.id, actionId));
    revalidateStudio(owned.productId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not delete. Try again." };
  }
}

/** Enable or disable an action. Ownership-checked via product join. */
export async function toggleAction(actionId: string, enabled: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const owned = await assertActionOwner(actionId, user.id);
  if (!owned.ok) return owned;

  try {
    await db.update(productActions).set({ enabled }).where(eq(productActions.id, actionId));
    revalidateStudio(owned.productId);
    return { ok: true, id: actionId };
  } catch {
    return { ok: false, error: "Could not update. Try again." };
  }
}
