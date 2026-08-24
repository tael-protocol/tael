import "server-only";

import { and, channelLinks, eq, agents } from "@tael/database";
import { db } from "../../lib/db";

export interface ResolvedChannelLink {
  userId: string;
  agentId: string;
}

/** Look up a Telegram user's linked Card for a product bot. */
export async function getTelegramChannelLink(
  productId: string,
  telegramUserId: string,
): Promise<ResolvedChannelLink | null> {
  const [row] = await db
    .select({
      userId: channelLinks.userId,
      agentId: channelLinks.agentId,
    })
    .from(channelLinks)
    .where(
      and(
        eq(channelLinks.channel, "telegram"),
        eq(channelLinks.productId, productId),
        eq(channelLinks.externalUserId, telegramUserId),
      ),
    )
    .limit(1);

  if (!row?.agentId) return null;
  return { userId: row.userId, agentId: row.agentId };
}

/** Upsert Telegram → user + Card link for a product. Verifies Card ownership. */
export async function upsertTelegramChannelLink(input: {
  productId: string;
  telegramUserId: string;
  userId: string;
  agentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [card] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, input.userId)))
    .limit(1);

  if (!card) return { ok: false, error: "That Card does not belong to you." };

  const existing = await getTelegramChannelLink(input.productId, input.telegramUserId);
  if (existing) {
    await db
      .update(channelLinks)
      .set({
        userId: input.userId,
        agentId: input.agentId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelLinks.channel, "telegram"),
          eq(channelLinks.productId, input.productId),
          eq(channelLinks.externalUserId, input.telegramUserId),
        ),
      );
  } else {
    await db.insert(channelLinks).values({
      channel: "telegram",
      productId: input.productId,
      externalUserId: input.telegramUserId,
      userId: input.userId,
      agentId: input.agentId,
    });
  }

  return { ok: true };
}

/** Remove a Telegram link for this product. */
export async function deleteTelegramChannelLink(
  productId: string,
  telegramUserId: string,
): Promise<void> {
  await db
    .delete(channelLinks)
    .where(
      and(
        eq(channelLinks.channel, "telegram"),
        eq(channelLinks.productId, productId),
        eq(channelLinks.externalUserId, telegramUserId),
      ),
    );
}
