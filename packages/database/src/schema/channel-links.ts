import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./_shared";
import { users } from "./users";
import { agents } from "./agents";
import { products } from "./products";

/**
 * Links a chat-platform user (Telegram/Discord) to a Tael user + default Card
 * for paid capability runs on a specific product bot.
 */
export const channelLinks = pgTable(
  "channel_links",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Card that pays; must belong to userId. */
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** "telegram" | "discord" */
    channel: text("channel").notNull(),
    /** Telegram: String(from.id); Discord: snowflake */
    externalUserId: text("external_user_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("channel_links_channel_ext_product_uidx").on(
      t.channel,
      t.externalUserId,
      t.productId,
    ),
    index("channel_links_user_id_idx").on(t.userId),
    index("channel_links_product_id_idx").on(t.productId),
  ],
);

export type ChannelLink = typeof channelLinks.$inferSelect;
export type NewChannelLink = typeof channelLinks.$inferInsert;
