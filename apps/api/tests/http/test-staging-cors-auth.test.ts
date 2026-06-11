import indexRouter from "@/app-router";
import { DEV_AUTH_PASSWORD } from "@edaya/dev-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import createApp from "@/lib/http/create-app";
import { parseEnv } from "@/lib/runtime/env";
import { createAuth } from "@/lib/runtime/create-auth";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations as runAuthMigrations } from "@edaya/adaptor-betterauth";
import { drizzle } from "drizzle-orm/pglite";

const stagingEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "production",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "https://api.edaya.test",
  TRUSTED_ORIGINS: "https://app.edaya.test",
  COOKIE_DOMAIN: "edaya.test",
});

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

describe("staging CORS and cross-subdomain auth cookies", () => {
  let pglite: PGlite;

  beforeEach(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite);
    await runAuthMigrations(db, { driver: "pglite" });
  });

  afterEach(async () => {
    await pglite.close();
  });

  it("allows credentialed requests from the trusted SPA origin", async () => {
    const app = createApp();
    app.route("/", indexRouter);

    const response = await app.fetch(new Request("https://api.edaya.test/core/entities/schools/list", {
      method: "OPTIONS",
      headers: {
        "Origin": "https://app.edaya.test",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-academic-year-id",
      },
    }), stagingEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.edaya.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("sets Better Auth session cookies on the configured parent domain", async () => {
    const db = drizzle(pglite);
    const auth = createAuth(db, stagingEnv);

    const signUpResponse = await auth.handler(new Request("https://api.edaya.test/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "https://app.edaya.test",
      },
      body: JSON.stringify({
        email: "staging@school.edu",
        password: DEV_AUTH_PASSWORD,
        name: "Staging User",
      }),
    }));

    expect(signUpResponse.status).toBe(200);

    const cookies = collectSetCookieHeaders(signUpResponse);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some(cookie => /domain=\.?edaya\.test/i.test(cookie))).toBe(true);
  });
});
