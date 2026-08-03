import { relations } from "drizzle-orm";
import { users } from "./users";
import { wallets } from "./wallets";
import { capabilities } from "./capabilities";
import { agents } from "./agents";
import { payments } from "./payments";
import { apiKeys } from "./api-keys";
import { chatThreads, chatMessages } from "./chat";
import { products, productContent, productActions } from "./products";

// Typed relations enable Drizzle's relational query API (db.query.users.findMany
// with `with: { wallets: true }`, etc.) without hand-written joins.

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  agents: many(agents),
  capabilities: many(capabilities),
  apiKeys: many(apiKeys),
  products: many(products),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  owner: one(users, { fields: [wallets.ownerId], references: [users.id] }),
  agents: many(agents),
}));

export const capabilitiesRelations = relations(capabilities, ({ one, many }) => ({
  publisher: one(users, { fields: [capabilities.publisherId], references: [users.id] }),
  payments: many(payments),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(users, { fields: [agents.ownerId], references: [users.id] }),
  wallet: one(wallets, { fields: [agents.walletId], references: [wallets.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  capability: one(capabilities, { fields: [payments.capabilityId], references: [capabilities.id] }),
  agent: one(agents, { fields: [payments.agentId], references: [agents.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  owner: one(users, { fields: [apiKeys.ownerId], references: [users.id] }),
}));

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  owner: one(users, { fields: [chatThreads.ownerId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  thread: one(chatThreads, { fields: [chatMessages.threadId], references: [chatThreads.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  owner: one(users, { fields: [products.ownerId], references: [users.id] }),
  content: many(productContent),
  actions: many(productActions),
}));

export const productContentRelations = relations(productContent, ({ one }) => ({
  product: one(products, { fields: [productContent.productId], references: [products.id] }),
}));

export const productActionsRelations = relations(productActions, ({ one }) => ({
  product: one(products, { fields: [productActions.productId], references: [products.id] }),
}));
