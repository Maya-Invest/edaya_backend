import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_PERIOD_DEFINITIONS,
} from "@edaya/dev-fixtures";
import { parseEnv } from "@/lib/runtime/env";
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

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((entry) => {
    if (entry && typeof entry === "object" && "data" in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data;
    }
    return entry as T;
  });
}

const pgliteEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("dev period definitions seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("seeds daily time slots and lets teachers list them via period-definitions/list", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const seedResult = await runDevSeed(application);
    expect(seedResult.status).toBe("seeded");
    if (seedResult.status === "seeded") {
      expect(seedResult.periodDefinitions).toBe(SEED_PERIOD_DEFINITIONS.length);
    }

    const stored = await application.repositories.periodDefinitions.list({});
    expect(stored.length).toBe(SEED_PERIOD_DEFINITIONS.length);
    expect(stored.some(slot => slot.label === "Période 1" && slot.startTime === "08:00")).toBe(true);
    expect(stored.filter(slot => slot.isBreak).length).toBe(3);

    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const signIn = await app.request(createAppRequest("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }));
    const cookies = collectSetCookieHeaders(signIn);
    const authHeaders = {
      "content-type": "application/json",
      "cookie": cookies.join("; "),
    };

    const response = await app.request(createAppRequest("/core/entities/period-definitions/list", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(200);
    const body = unwrapEntityList<{ label: string; startTime: string; endTime: string; isBreak: boolean }>(
      await response.json(),
    );
    expect(body.length).toBeGreaterThanOrEqual(SEED_PERIOD_DEFINITIONS.length);
    expect(body.some(slot => slot.startTime === "08:00" && slot.endTime === "08:45")).toBe(true);
  }, 30_000);
});
