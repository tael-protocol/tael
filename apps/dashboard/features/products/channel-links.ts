import "server-only";

import { and, channelLinks, eq, agents } from "@tael/database";
import { db } from "../../lib/db";

export interface ResolvedChannelLink {
  userId: string;
  agentId: string;
}

async function getChannelLink(
  channel: "telegram" | "discord",
  productId: string,
  externalUserId: string,
): Promise<ResolvedChannelLink | null> {
  const [row] = await db
    .select({
      userId: channelLinks.userId,
      agentId: channelLinks.agentId,
    })
    .from(channelLinks)
    .where(
      and(
        eq(channelLinks.channel, channel),
        eq(channelLinks.productId, productId),
        eq(channelLinks.externalUserId, externalUserId),
      ),
    )
    .limit(1);

  if (!row?.agentId) return null;
  return { userId: row.userId, agentId: row.agentId };
}

async function upsertChannelLink(input: {
  channel: "telegram" | "discord";
  productId: string;
  externalUserId: string;
  userId: string;
  agentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [card] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, input.agentId), eq(agents.ownerId, input.userId)))
    .limit(1);

  if (!card) return { ok: false, error: "That Card does not belong to you." };

  const existing = await getChannelLink(input.channel, input.productId, input.externalUserId);
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
          eq(channelLinks.channel, input.channel),
          eq(channelLinks.productId, input.productId),
          eq(channelLinks.externalUserId, input.externalUserId),
        ),
      );
  } else {
    await db.insert(channelLinks).values({
      channel: input.channel,
      productId: input.productId,
      externalUserId: input.externalUserId,
      userId: input.userId,
      agentId: input.agentId,
    });
  }

  return { ok: true };
}

async function deleteChannelLink(
  channel: "telegram" | "discord",
  productId: string,
  externalUserId: string,
): Promise<void> {
  await db
    .delete(channelLinks)
    .where(
      and(
        eq(channelLinks.channel, channel),
        eq(channelLinks.productId, productId),
        eq(channelLinks.externalUserId, externalUserId),
      ),
    );
}

/** Look up a Telegram user's linked Card for a product bot. */
export async function getTelegramChannelLink(
  productId: string,
  telegramUserId: string,
): Promise<ResolvedChannelLink | null> {
  return getChannelLink("telegram", productId, telegramUserId);
}

/** Upsert Telegram → user + Card link for a product. Verifies Card ownership. */
export async function upsertTelegramChannelLink(input: {
  productId: string;
  telegramUserId: string;
  userId: string;
  agentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return upsertChannelLink({
    channel: "telegram",
    productId: input.productId,
    externalUserId: input.telegramUserId,
    userId: input.userId,
    agentId: input.agentId,
  });
}

/** Remove a Telegram link for this product. */
export async function deleteTelegramChannelLink(
  productId: string,
  telegramUserId: string,
): Promise<void> {
  return deleteChannelLink("telegram", productId, telegramUserId);
}

/** Look up a Discord user's linked Card for a product bot. */
export async function getDiscordChannelLink(
  productId: string,
  discordUserId: string,
): Promise<ResolvedChannelLink | null> {
  return getChannelLink("discord", productId, discordUserId);
}

/** Upsert Discord → user + Card link for a product. Verifies Card ownership. */
export async function upsertDiscordChannelLink(input: {
  productId: string;
  discordUserId: string;
  userId: string;
  agentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return upsertChannelLink({
    channel: "discord",
    productId: input.productId,
    externalUserId: input.discordUserId,
    userId: input.userId,
    agentId: input.agentId,
  });
}

/** Remove a Discord link for this product. */
export async function deleteDiscordChannelLink(
  productId: string,
  discordUserId: string,
): Promise<void> {
  return deleteChannelLink("discord", productId, discordUserId);
}
