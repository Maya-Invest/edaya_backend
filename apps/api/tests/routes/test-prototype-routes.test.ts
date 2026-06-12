import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_ACTIVITIES,
} from "@edaya/dev-fixtures";
import { parseEnv } from "@/lib/runtime/env";
import { getApiRuntime, resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { runDevAccessSeed } from "@/lib/seed/run-dev-access-seed";
import { runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { runDevSeed } from "@/lib/seed/run-dev-seed";
import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
  pgliteEnv,
} from "../support/better-auth-route-harness";
import indexRouter from "@/app-router";
import { dependenciesInjection } from "@/lib/http/dependencies";
import type { AppBindings } from "@/lib/http/types";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "bun:test";

describe("prototype stub routes", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("returns seeded activities for authenticated staff", async () => {
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

    const activitiesResponse = await app.request(createAppRequest("/core/prototype/activities/list", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    }));

    expect(activitiesResponse.status).toBe(200);

    const activities = await activitiesResponse.json() as Array<{ id: string }>;

    expect(activities.length).toBe(SEED_ACTIVITIES.length);
    expect(activities.some(activity => activity.id === "act-robot")).toBe(true);
  }, 30_000);
});

describe("demo login accounts route", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  async function createAppWithEnv(env: ReturnType<typeof parseEnv>) {
    await resetApiRuntimesForTests();
    await getApiRuntime(env);

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = env;
      await next();
    });
    app.use(dependenciesInjection);
    app.route("/", indexRouter);

    return app;
  }

  it("returns linked staff demo accounts without authentication in development", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await runDevSeed(application);
    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const response = await app.request(createAppRequest("/core/auth/demo-login-accounts/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(200);

    const demoAccounts = await response.json() as Array<{
      staffId: string;
      email: string;
      role: string;
    }>;

    expect(demoAccounts).toHaveLength(4);
    expect(demoAccounts.find(account => account.staffId === "st5")).toMatchObject({
      email: "c.moreau@school.edu",
      role: "directeur",
    });
    expect(demoAccounts.find(account => account.staffId === "st3")).toMatchObject({
      role: "prof_principal",
    });
    expect(demoAccounts.find(account => account.staffId === "st7")).toMatchObject({
      role: "educateur",
    });
    expect(demoAccounts.find(account => account.staffId === "st1")).toMatchObject({
      email: "m.dupont@school.edu",
      role: "professeur",
    });
    expect(demoAccounts.some(account => account.staffId === "st2")).toBe(false);
  }, 30_000);

  it("returns 503 when demo login accounts are disabled in production", async () => {
    const productionEnv = parseEnv({
      RUNTIME: "node",
      NODE_ENV: "production",
      PORT: 9999,
      LOG_LEVEL: "silent",
      DATABASE_URL: "pglite",
      BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
      BETTER_AUTH_URL: "http://localhost:9999",
      ALLOW_DEMO_LOGIN_ACCOUNTS: false,
    });

    const app = await createAppWithEnv(productionEnv);

    const response = await app.request(createAppRequest("/core/auth/demo-login-accounts/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      message: "Demo login accounts are disabled in this environment",
    });
  });
});
