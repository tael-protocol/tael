"use server";

import { z } from "zod";
import { and, eq, products } from "@tael/database";
import { db } from "../../lib/db";
import { getCurrentUser } from "../capabilities/current-user";
import { revalidateStudioPaths } from "./revalidate";

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

const updateProductSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  brandColor: brandColorSchema.optional(),
  greeting: greetingSchema.optional(),
  status: statusSchema.optional(),
  logoUrl: z.string().max(200_000).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
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

/** Connect a Telegram Bot to this product agent. Ownership-checked. */
export async function connectTelegramBot(
  id: string,
  botToken: string,
  baseUrl: string,
): Promise<ActionResult & { botUsername?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const cleanToken = botToken.trim();
  if (!cleanToken) return { ok: false, error: "Telegram Bot Token is required." };

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.ownerId, user.id)))
    .limit(1);

  if (!product) return { ok: false, error: "Agent not found." };

  const { getTelegramBotInfo, setTelegramWebhook } = await import("./telegram");
  const info = await getTelegramBotInfo(cleanToken);
  if (!info.ok || !info.username) {
    return { ok: false, error: info.error ?? "Invalid bot token." };
  }

  const secretToken = crypto.randomUUID().replace(/-/g, "");
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/widget/${encodeURIComponent(product.publicKey)}/telegram`;
  const hookResult = await setTelegramWebhook(cleanToken, webhookUrl, secretToken);
  if (!hookResult.ok) {
    return { ok: false, error: hookResult.error ?? "Could not configure Telegram webhook." };
  }

  const currentSettings = (product.settings as Record<string, unknown>) ?? {};
  const updatedSettings = {
    ...currentSettings,
    telegramBotToken: cleanToken,
    telegramBotUsername: info.username,
    telegramBotEnabled: true,
    telegramSecretToken: secretToken,
  };

  await db
    .update(products)
    .set({ settings: updatedSettings })
    .where(eq(products.id, id));

  revalidateStudioPaths();
  return { ok: true, botUsername: info.username };
}

/** Disconnect / Disable Telegram Bot for this product agent. Ownership-checked. */
export async function disconnectTelegramBot(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.ownerId, user.id)))
    .limit(1);

  if (!product) return { ok: false, error: "Agent not found." };

  const currentSettings = (product.settings as Record<string, unknown>) ?? {};
  const token = typeof currentSettings.telegramBotToken === "string" ? currentSettings.telegramBotToken : null;

  if (token) {
    const { deleteTelegramWebhook } = await import("./telegram");
    await deleteTelegramWebhook(token);
  }

  const updatedSettings = {
    ...currentSettings,
    telegramBotEnabled: false,
  };

  await db
    .update(products)
    .set({ settings: updatedSettings })
    .where(eq(products.id, id));

  revalidateStudioPaths();
  return { ok: true };
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

