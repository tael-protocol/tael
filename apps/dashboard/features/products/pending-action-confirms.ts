import "server-only";

import { and, eq, gt, pendingActionConfirms } from "@tael/database";
import { randomBytes } from "node:crypto";
import { db } from "../../lib/db";

export {
  buildPendingCallbackData,
  parseActionCallbackData,
} from "./pending-callback";

const TTL_MS = 15 * 60 * 1000;

function newToken(): string {
  return randomBytes(12).toString("base64url");
}

export interface CreatePendingConfirmInput {
  productId: string;
  actionId: string;
  channel: "telegram" | "discord";
  externalUserId?: string | null;
  params?: string | Record<string, unknown> | null;
}

/** Persist action params and return a short token for callback_data. */
export async function createPendingActionConfirm(
  input: CreatePendingConfirmInput,
): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(pendingActionConfirms).values({
    token,
    productId: input.productId,
    actionId: input.actionId,
    channel: input.channel,
    externalUserId: input.externalUserId ?? null,
    params: input.params ?? null,
    expiresAt,
  });
  return token;
}

export interface ConsumedPendingConfirm {
  actionId: string;
  productId: string;
  params: string | Record<string, unknown> | null;
}

/**
 * Load + delete a pending confirm by token. Returns null if missing, expired,
 * wrong channel, or external user mismatch.
 */
export async function consumePendingActionConfirm(input: {
  token: string;
  channel: "telegram" | "discord";
  externalUserId?: string | null;
}): Promise<ConsumedPendingConfirm | null> {
  const now = new Date();
  const [row] = await db
    .select({
      id: pendingActionConfirms.id,
      actionId: pendingActionConfirms.actionId,
      productId: pendingActionConfirms.productId,
      params: pendingActionConfirms.params,
      externalUserId: pendingActionConfirms.externalUserId,
      channel: pendingActionConfirms.channel,
    })
    .from(pendingActionConfirms)
    .where(
      and(
        eq(pendingActionConfirms.token, input.token),
        eq(pendingActionConfirms.channel, input.channel),
        gt(pendingActionConfirms.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  if (
    row.externalUserId &&
    input.externalUserId &&
    row.externalUserId !== input.externalUserId
  ) {
    return null;
  }

  await db.delete(pendingActionConfirms).where(eq(pendingActionConfirms.id, row.id));

  return {
    actionId: row.actionId,
    productId: row.productId,
    params: row.params ?? null,
  };
}
