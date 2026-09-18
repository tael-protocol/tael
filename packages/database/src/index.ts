// @tael/database — the persistence layer.
// Drizzle schema, a typed Postgres client, and migrations. Everything the rest
// of the system reads/writes goes through here. App code depends on the client;
// the schema types are re-exported for repositories and services.
export * from "./client";
export * from "./crypto";
export * from "./errors";
export * from "./ssl";
export * as schema from "./schema";
export * from "./schema";

// Re-export the common query operators so consumers import them from one place
// (avoids every app also depending on drizzle-orm directly).
export {
  eq,
  ne,
  and,
  or,
  not,
  desc,
  asc,
  sql,
  ilike,
  inArray,
  isNull,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
  count,
} from "drizzle-orm";
