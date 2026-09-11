import { describe, expect, it, mock } from "bun:test";
import { runMigrations } from "@edaya/adaptor-auth";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { buildBetterAuthConfig, createBetterAuth } from "@/runtime/shared/adapters/better-auth";
import { attachAuthDatabase } from "@/runtime/shared/auth-database";
import { parseEnv } from "@/runtime/shared/env/schema";

describe("release-candidate authentication invariants", () => {
  it("does not trust a seed header on public production signup", async () => {
    const database = new PGlite();
    try {
      const db = drizzle(database);
      await runMigrations(db, { driver: "pglite" });
      const auth = createBetterAuth(db, {
        NODE_ENV: "production",
        LOG_LEVEL: "silent",
        BETTER_AUTH_URL: "https://api.example.test",
        BETTER_AUTH_SECRET: "9d44b86aec137c862bff0c5df41ac5816ac02c759",
        REQUIRE_EMAIL_VERIFICATION: true,
      });
      const response = await auth.handler(new Request("https://api.example.test/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", "x-edaya-seed-provision": "1" },
        body: JSON.stringify({ email: "fixture@example.test", password: "Only-a-test-password-42", name: "Fixture" }),
      }));
      expect(response.status).toBe(200);
      const result = await database.query<{ email_verified: boolean }>("SELECT email_verified FROM auth.\"user\"");
      expect(result.rows).toEqual([{ email_verified: false }]);
    }
    finally {
      await database.close();
    }
  });

  it("does not configure secondary session authority even if storage was supplied", () => {
    const config = buildBetterAuthConfig({}, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:9999",
    }, { secondaryStorage: { get: async () => null, set: async () => {}, delete: async () => {} } });
    expect(config.secondaryStorage).toBeUndefined();
    expect(config.session?.cookieCache?.enabled).toBe(false);
  });

  it("parses boolean strings without treating false as truthy", () => {
    for (const value of ["false", "0", false]) {
      expect(parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: value }).ALLOW_PUBLIC_SCHOOL_REGISTRATION).toBe(false);
    }
    for (const value of ["true", "1", true]) {
      expect(parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: value }).ALLOW_PUBLIC_SCHOOL_REGISTRATION).toBe(true);
    }
    expect(() => parseEnv({ DATABASE_URL: "pglite", ALLOW_PUBLIC_SCHOOL_REGISTRATION: "perhaps" })).toThrow();
  });

  it("rejects missing, weak and placeholder production secrets", () => {
    for (const secret of [undefined, "short", "super-secret-placeholder-key-for-local-testing"]) {
      expect(() => parseEnv({ DATABASE_URL: "pglite", NODE_ENV: "production", BETTER_AUTH_SECRET: secret })).toThrow("BETTER_AUTH_SECRET");
    }
    expect(() => parseEnv({ DATABASE_URL: "pglite", NODE_ENV: "production", BETTER_AUTH_SECRET: "9d44b86aec137c862bff0c5df41ac5816ac02c759" })).not.toThrow();
    expect(() => parseEnv({ DATABASE_URL: "pglite", GRANTS_CACHE_TTL_MS: 300000 })).toThrow("GRANTS_CACHE_TTL_MS");
  });

  it("closes owned database handles once and never closes borrowed handles", async () => {
    const dispose = mock(async () => {});
    const handle = { db: {} as never, sqlClient: null, dispose };
    const borrowed = await attachAuthDatabase(handle, { databaseUrl: "pglite" });
    await borrowed.dispose();
    expect(dispose).toHaveBeenCalledTimes(0);
    const owned = await attachAuthDatabase(handle, { databaseUrl: "pglite", ownership: "owned" });
    await Promise.all([owned.dispose(), owned.dispose()]);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("closes an owned handle when auth initialization fails", async () => {
    const dispose = mock(async () => {});
    await expect(attachAuthDatabase({ db: {} as never, sqlClient: null, dispose }, {
      databaseUrl: "pglite",
      ownership: "owned",
      runMigrations: true,
    })).rejects.toThrow();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
