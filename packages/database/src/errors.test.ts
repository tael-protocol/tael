import { describe, expect, it } from "vitest";
import {
  DatabaseUnavailableError,
  databaseErrorMessage,
  isMissingTenantError,
  toDatabaseError,
} from "./errors";

describe("isMissingTenantError", () => {
  it("detects the Supavisor tenant-not-found FATAL from a Drizzle wrapper", () => {
    const cause = Object.assign(
      new Error("(ENOTFOUND) tenant/user postgres.hndszjqotpmmenkwkhme not found"),
      {
        code: "XX000",
      },
    );
    const wrapped = new Error(
      'Failed query: select "id", "wallet_address" from "users" where "users"."wallet_address" = $1 limit $2',
      { cause },
    );
    expect(isMissingTenantError(wrapped)).toBe(true);
    expect(databaseErrorMessage(wrapped)).toMatch(/tenant in DATABASE_URL was not found/);
  });

  it("detects the unprefixed pooler message", () => {
    expect(isMissingTenantError(new Error("FATAL: Tenant or user not found"))).toBe(true);
  });

  it("does not flag unrelated query failures", () => {
    expect(isMissingTenantError(new Error('relation "users" does not exist'))).toBe(false);
    expect(databaseErrorMessage(new Error("connection refused"))).toBe(
      "The database is unavailable.",
    );
  });
});

describe("toDatabaseError", () => {
  it("returns the same instance when already classified", () => {
    const original = new DatabaseUnavailableError("already");
    expect(toDatabaseError(original)).toBe(original);
  });

  it("maps a missing DATABASE_URL throw", () => {
    const mapped = toDatabaseError(new Error("DATABASE_URL is not set"));
    expect(mapped).toBeInstanceOf(DatabaseUnavailableError);
    expect(mapped.message).toBe("DATABASE_URL is not set.");
  });
});
