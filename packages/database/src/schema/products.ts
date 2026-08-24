import { boolean, index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./_shared";
import { users } from "./users";

/** Lifecycle of a product agent: draft until the owner goes live. */
export const productStatus = pgEnum("product_status", ["draft", "live"]);

/** Kinds of content the agent can be trained on. */
export const productContentType = pgEnum("product_content_type", [
  "doc",
  "snippet",
  "website",
  "faq",
]);

/**
 * How a product action is invoked:
 *  - `capability` — a Tael capability slug
 *  - `http` — a direct HTTP call with url/method/paramsSchema
 */
export const productActionKind = pgEnum("product_action_kind", ["capability", "http"]);

/**
 * Config for a product action. Discriminated by `kind` on the row:
 *  - capability → `{ slug, operation? }` (e.g. slug `stellar` + operation `pay`,
 *    or combined slug `stellar/pay`)
 *  - http → `{ url, method, paramsSchema? }`
 */
export type ProductActionConfig =
  | { slug: string; operation?: string }
  | { url: string; method: string; paramsSchema?: Record<string, unknown> };

/**
 * One product tenant: an embeddable agent configured by a product owner.
 * `publicKey` is the Stripe-style publishable key used by the embed snippet.
 */
export const products = pgTable(
  "products",
  {
    id: primaryId(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** URL-safe unique handle. */
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Optional product logo URL for widget branding. */
    logoUrl: text("logo_url"),
    /** Widget accent color. */
    brandColor: text("brand_color").notNull().default("#156DFC"),
    /** First message the widget shows. */
    greeting: text("greeting").notNull().default(""),
    /** Embed key, safe to expose (e.g. `tael_pub_…`). */
    publicKey: text("public_key").notNull().unique(),
    status: productStatus("status").notNull().default("draft"),
    /** Misc future config (channels, etc.). */
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [index("products_owner_id_idx").on(table.ownerId)],
);

/** Content the product agent knows (Train data). */
export const productContent = pgTable(
  "product_content",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: productContentType("type").notNull(),
    title: text("title").notNull(),
    /** The text the agent uses at chat time. */
    body: text("body").notNull(),
    /** Source URL for website sync. */
    sourceUrl: text("source_url"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("product_content_product_id_idx").on(table.productId)],
);

/** Actions the product agent can run (connected capabilities / HTTP). */
export const productActions = pgTable(
  "product_actions",
  {
    id: primaryId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** What it does and when the agent should use it. */
    description: text("description").notNull(),
    kind: productActionKind("kind").notNull(),
    config: jsonb("config").$type<ProductActionConfig>().notNull(),
    /** Opt-in: publish so other agents can call it as a capability. */
    shareAsCapability: boolean("share_as_capability").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("product_actions_product_id_idx").on(table.productId)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductContent = typeof productContent.$inferSelect;
export type NewProductContent = typeof productContent.$inferInsert;
export type ProductAction = typeof productActions.$inferSelect;
export type NewProductAction = typeof productActions.$inferInsert;
