import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_ACTIVITIES,
  SEED_DEADLINES,
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

const pgliteEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("prototype stub routes", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("returns seeded activities and deadlines for authenticated staff", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await runDevSeed(application);
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

    const [activitiesResponse, deadlinesResponse, filteredDeadlinesResponse] = await Promise.all([
      app.request(createAppRequest("/core/prototype/activities/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/prototype/deadlines/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/prototype/deadlines/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ classGroupId: "6a" }),
      })),
    ]);

    expect(activitiesResponse.status).toBe(200);
    expect(deadlinesResponse.status).toBe(200);
    expect(filteredDeadlinesResponse.status).toBe(200);

    const activities = await activitiesResponse.json() as Array<{ id: string }>;
    const deadlines = await deadlinesResponse.json() as Array<{ id: string; classGroupId: string }>;
    const filteredDeadlines = await filteredDeadlinesResponse.json() as Array<{ id: string; classGroupId: string }>;

    expect(activities.length).toBe(SEED_ACTIVITIES.length);
    expect(deadlines.length).toBe(SEED_DEADLINES.length);
    expect(filteredDeadlines.length).toBe(SEED_DEADLINES.filter(d => d.classGroupId === "6a").length);
    expect(filteredDeadlines.every(deadline => deadline.classGroupId === "6a")).toBe(true);
    expect(activities.some(activity => activity.id === "act-robot")).toBe(true);
    expect(deadlines.some(deadline => deadline.id === "d1" && deadline.classGroupId === "6a")).toBe(true);
  }, 30_000);
});
