/**
 * Map driver/ORM failures into a single, safe error the UI can show.
 * Drizzle wraps the postgres.js error as `Failed query: ...` with the original
 * in `cause` — walk that chain so we classify the real failure.
 */

export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

export function toDatabaseError(error: unknown): DatabaseUnavailableError {
  if (error instanceof DatabaseUnavailableError) return error;
  return new DatabaseUnavailableError(databaseErrorMessage(error), { cause: error });
}

export function databaseErrorMessage(error: unknown): string {
  if (isMissingTenantError(error)) {
    return "Postgres rejected the connection: the database tenant in DATABASE_URL was not found. The project is paused or deleted, or the URI points at the wrong pooler.";
  }
  if (isMissingDatabaseUrl(error)) {
    return "DATABASE_URL is not set.";
  }
  return "The database is unavailable.";
}

export function isMissingTenantError(error: unknown): boolean {
  const text = flattenErrorText(error);
  return /tenant\/user .+ not found/i.test(text) || /tenant or user not found/i.test(text);
}

function isMissingDatabaseUrl(error: unknown): boolean {
  return /DATABASE_URL is not set/i.test(flattenErrorText(error));
}

function flattenErrorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    if (current instanceof Error) {
      parts.push(current.message);
      if ("code" in current && typeof current.code === "string") {
        parts.push(current.code);
      }
      current = current.cause;
      continue;
    }
    if (typeof current === "object" && "message" in current) {
      const message = (current as { message: unknown }).message;
      if (typeof message === "string") parts.push(message);
    }
    break;
  }
  return parts.join("\n");
}
