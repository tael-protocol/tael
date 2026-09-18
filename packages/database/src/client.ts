import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { sslForConnectionString } from "./ssl";

export type Database = ReturnType<typeof createDatabase>;

/**
 * Create a Drizzle client over a postgres-js connection. Use the pooled
 * `DATABASE_URL` (Supabase transaction pooler, :6543) at runtime — it's built for
 * many short-lived serverless connections. Migrations use the direct/session URL.
 */
export function createDatabase(connectionString: string) {
  const ssl = sslForConnectionString(connectionString);
  const client = postgres(connectionString, {
    // The transaction pooler doesn't support prepared statements.
    prepare: false,
    // One connection per serverless isolate — the pooler already multiplexes.
    max: process.env.VERCEL ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(ssl ? { ssl } : {}),
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

let singleton: Database | undefined;

/**
 * Process-wide singleton built from `DATABASE_URL`. Prefer this in app code so
 * we don't open a new pool per request. Throws early if the URL is missing.
 */
export function getDatabase(): Database {
  if (!singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    singleton = createDatabase(url);
  }
  return singleton;
}
