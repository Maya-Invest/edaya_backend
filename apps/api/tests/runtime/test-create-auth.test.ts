import { DEV_AUTH_PASSWORD } from "@edaya/dev-fixtures";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations as runAuthMigrations } from "@edaya/adaptor-betterauth";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { createAuth } from "@/lib/runtime/create-auth";
import type { Environment } from "@/lib/bootstrap/env";

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

describe("createAuth", () => {
  let auth: ReturnType<typeof createAuth>;
  let pglite: PGlite;

  beforeEach(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite);
    await runAuthMigrations(db, { driver: "pglite" });
    auth = createAuth(db, testEnv);
  });

  afterEach(async () => {
    await pglite.close();
  });

  it("signs up a user and returns a session", async () => {
    const signUpResponse = await auth.handler(new Request("http://localhost:9999/api/auth/sign-up/email", {
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

    const sessionResponse = await auth.handler(new Request("http://localhost:9999/api/auth/get-session", {
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
    await auth.handler(new Request("http://localhost:9999/api/auth/sign-up/email", {
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

    const signInResponse = await auth.handler(new Request("http://localhost:9999/api/auth/sign-in/email", {
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
});
