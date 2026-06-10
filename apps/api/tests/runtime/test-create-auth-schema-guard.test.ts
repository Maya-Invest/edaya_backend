import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authSchema } from "@edaya/adaptor-betterauth";
import { describe, expect, it, mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Environment } from "@/lib/bootstrap/env";

const testEnv = {
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
} as Environment;

describe("createAuth schema guard", () => {
  it("keeps authSchema imported and passed to drizzleAdapter", () => {
    const sourcePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../src/lib/runtime/create-auth.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("@edaya/adaptor-betterauth");
    expect(source).toContain("authSchema");
    expect(source).toMatch(/schema:\s*authSchema/);
  });

  it("passes authSchema to drizzleAdapter at runtime", async () => {
    const drizzleAdapter = mock((_db: unknown, config: { schema: unknown; provider: string }) => {
      expect(config.provider).toBe("pg");
      expect(config.schema).toBe(authSchema);
      return {};
    });

    mock.module("better-auth/adapters/drizzle", () => ({
      drizzleAdapter,
    }));
    mock.module("better-auth", () => ({
      betterAuth: (options: { database: unknown }) => ({
        handler: async () => new Response(),
        api: {
          getSession: async () => null,
        },
        options,
      }),
    }));

    const { createAuth } = await import("@/lib/runtime/create-auth");
    const pglite = new PGlite();
    const db = drizzle(pglite);

    createAuth(db, testEnv);

    expect(drizzleAdapter).toHaveBeenCalledTimes(1);

    mock.restore();
  });
});
