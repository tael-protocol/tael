import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./_shared";
import { productActions, products } from "./products";

/**
 * Short-lived server-side params for Telegram/Discord confirm buttons.
 * Telegram callback_data is capped at 64 bytes, so full Pay params (Stellar
 * addresses) cannot fit in the button — only a short token is embedded.
 */
export const pendingActionConfirms = pgTable(
  "pending_action_confirms",
  {
    id: primaryId(),
    /** Short opaque token placed in callback_data / custom_id. */
    token: text("token").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    actionId: uuid("action_id")
      .notNull()
      .references(() => productActions.id, { onDelete: "cascade" }),
    /** "telegram" | "discord" */
    channel: text("channel").notNull(),
    /** Telegram from.id / Discord snowflake — confirm must match. */
    externalUserId: text("external_user_id"),
    /** Params the model filled (query string, JSON object, or string). */
    params: jsonb("params").$type<string | Record<string, unknown> | null>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("pending_action_confirms_token_uidx").on(t.token),
    index("pending_action_confirms_product_id_idx").on(t.productId),
    index("pending_action_confirms_expires_at_idx").on(t.expiresAt),
  ],
);

export type PendingActionConfirm = typeof pendingActionConfirms.$inferSelect;
export type NewPendingActionConfirm = typeof pendingActionConfirms.$inferInsert;
