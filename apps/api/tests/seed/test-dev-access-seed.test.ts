import { DEV_AUTH_PASSWORD, DEV_AUTH_STAFF_ACCOUNTS } from "@edaya/dev-fixtures";
import { parseEnv } from "@/lib/bootstrap/env";
import { resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { runDevAccessSeed } from "@/lib/seed/run-dev-access-seed";
import { runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { runDevSeed } from "@/lib/seed/run-dev-seed";
import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from "../support/better-auth-route-harness";
import { afterEach, describe, expect, it } from "bun:test";

const pgliteEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("dev access seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("lets seeded teachers list students after access roles are provisioned", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await runDevSeed(application);
    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const signIn = await app.request(createAppRequest("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }));
    const cookies = collectSetCookieHeaders(signIn);

    const response = await app.request(createAppRequest("/api/core/entities/students/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(200);
  }, 30_000);

  it("lets seeded teachers list guardians and class subjects for migrated webapp slices", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await runDevSeed(application);
    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const signIn = await app.request(createAppRequest("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }));
    const cookies = collectSetCookieHeaders(signIn);
    const authHeaders = {
      "content-type": "application/json",
      "cookie": cookies.join("; "),
    };

    const guardians = await app.request(createAppRequest("/api/core/entities/guardians/list", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    }));
    const classSubjects = await app.request(createAppRequest("/api/core/entities/class-subjects/list", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    }));

    expect(guardians.status).toBe(200);
    expect(classSubjects.status).toBe(200);

    const guardianBody = await guardians.json() as unknown[];
    const classSubjectBody = await classSubjects.json() as unknown[];
    expect(guardianBody.length).toBeGreaterThanOrEqual(6);
    expect(classSubjectBody.length).toBeGreaterThanOrEqual(8);
  }, 30_000);
});
