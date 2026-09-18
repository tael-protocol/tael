import { describe, expect, it } from "vitest";
import { sslForConnectionString } from "./ssl";

describe("sslForConnectionString", () => {
  it("requires TLS for the Supabase shared pooler hostname", () => {
    expect(
      sslForConnectionString(
        "postgresql://postgres.abc:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe("require");
  });

  it("requires TLS for the direct Supabase host", () => {
    expect(
      sslForConnectionString("postgresql://postgres:pass@db.abc.supabase.co:5432/postgres"),
    ).toBe("require");
  });

  it("requires TLS for Neon", () => {
    expect(sslForConnectionString("postgresql://user:pass@ep-cool.aws.neon.tech/neondb")).toBe(
      "require",
    );
  });

  it("leaves local Postgres alone so sslmode in the URL still wins", () => {
    expect(sslForConnectionString("postgresql://postgres:postgres@localhost:5432/postgres")).toBe(
      undefined,
    );
  });

  it("ignores an unparseable URL", () => {
    expect(sslForConnectionString("not-a-url")).toBe(undefined);
  });
});
