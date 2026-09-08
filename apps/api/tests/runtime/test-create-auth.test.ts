import { DEV_AUTH_PASSWORD } from "@edaya/fixtures/demo-login";
import { createInMemoryAuthSecondaryStorage, runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createBetterAuth } from "@/runtime";
import type { Environment } from "@/runtime";
import {
  getLastAuthVerificationUrlForTests,
  resetAuthOtpMailerForTests,
} from "@/runtime/shared/adapters/auth-otp-mailer";

const testEnv = {
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
  LOG_LEVEL: "silent",
} as Environment;

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

describe("createBetterAuth", () => {
  let auth: ReturnType<typeof createBetterAuth>;
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    pglite = new PGlite();
    db = drizzle(pglite);
    await runAuthMigrations(db, { driver: "pglite" });
    auth = createBetterAuth(db, testEnv);
  });

  afterEach(async () => {
    resetAuthOtpMailerForTests();
    await pglite.close();
  });

  it("rewrites signup verification emails to the webapp login page", async () => {
    resetAuthOtpMailerForTests();
    const verificationAuth = createBetterAuth(db, {
      ...testEnv,
      NODE_ENV: "test",
      REQUIRE_EMAIL_VERIFICATION: true,
      WEBAPP_ORIGIN: "http://localhost:5173",
      TRUSTED_ORIGINS: "http://localhost:5173",
    } as Environment);

    const signUpResponse = await verificationAuth.handler(new Request("http://localhost:9999/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "owner@school.edu",
        password: DEV_AUTH_PASSWORD,
        name: "School Owner",
      }),
    }));

    expect(signUpResponse.status).toBe(200);

    const verifyUrl = getLastAuthVerificationUrlForTests("owner@school.edu");
    expect(verifyUrl).toBeDefined();
    expect(new URL(verifyUrl as string).searchParams.get("callbackURL"))
      .toBe("http://localhost:5173/login?verified=1");
  });

  it("signs up a user and returns a session", async () => {
    const signUpResponse = await auth.handler(new Request("http://localhost:9999/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "teacher@school.edu",
        password: DEV_AUTH_PASSWORD,
        name: "Teacher User",
      }),
    }));

    expect(signUpResponse.status).toBe(200);

    const cookies = collectSetCookieHeaders(signUpResponse);
    expect(cookies.length).toBeGreaterThan(0);

    const sessionResponse = await auth.handler(new Request("http://localhost:9999/auth/get-session", {
      method: "GET",
      headers: {
        cookie: cookies.join("; "),
      },
    }));

    expect(sessionResponse.status).toBe(200);

    const sessionBody = await sessionResponse.json() as {
      user?: { email?: string };
      session?: { id?: string };
    };

    expect(sessionBody.user?.email).toBe("teacher@school.edu");
    expect(sessionBody.session?.id).toBeTruthy();
  });

  it("signs in an existing user with email and password", async () => {
    await auth.handler(new Request("http://localhost:9999/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "existing@school.edu",
        password: DEV_AUTH_PASSWORD,
        name: "Existing User",
      }),
    }));

    const signInResponse = await auth.handler(new Request("http://localhost:9999/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "existing@school.edu",
        password: DEV_AUTH_PASSWORD,
      }),
    }));

    expect(signInResponse.status).toBe(200);
    expect(collectSetCookieHeaders(signInResponse).length).toBeGreaterThan(0);
  });

  it("exposes the Better Auth OpenAPI schema for Scalar sources", async () => {
    const schemaResponse = await auth.handler(
      new Request("http://localhost:9999/auth/open-api/generate-schema"),
    );

    expect(schemaResponse.status).toBe(200);

    const schema = await schemaResponse.json() as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(schema.openapi).toMatch(/^3\./);
    expect(schema.paths["/sign-in/email"]).toBeDefined();
  });

  it("does not serve a separate Better Auth reference page", async () => {
    const referenceResponse = await auth.handler(
      new Request("http://localhost:9999/auth/reference"),
    );

    expect(referenceResponse.status).toBe(404);
  });

  it("supports optional secondary storage without changing sign-in behavior", async () => {
    const secondaryStorage = createInMemoryAuthSecondaryStorage();
    const authWithStorage = createBetterAuth(db, testEnv, { secondaryStorage });

    const signUpResponse = await authWithStorage.handler(new Request("http://localhost:9999/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "kv-user@school.edu",
        password: DEV_AUTH_PASSWORD,
        name: "KV User",
      }),
    }));

    expect(signUpResponse.status).toBe(200);

    const cookies = collectSetCookieHeaders(signUpResponse);
    const sessionResponse = await authWithStorage.handler(new Request("http://localhost:9999/auth/get-session", {
      method: "GET",
      headers: {
        cookie: cookies.join("; "),
      },
    }));

    expect(sessionResponse.status).toBe(200);
    expect(secondaryStorage.snapshot().size).toBeGreaterThan(0);
  });
});
