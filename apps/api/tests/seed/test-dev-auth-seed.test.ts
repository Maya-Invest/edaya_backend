import { parseEnv } from "@/lib/bootstrap/env";
import { getApiRuntime, resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { createDependenciesInjection } from "@/lib/http/middleware/dependencies";
import { type AuthSessionProvider, createSessionActorDependency } from "@/lib/http/middleware/dependencies/session-actor";
import { DEV_AUTH_PASSWORD } from "@/lib/seed/dataset";
import { runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { runDevSeed } from "@/lib/seed/run-dev-seed";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "bun:test";
import type { AppBindings } from "@/lib/http/types";

const pgliteEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

describe("runDevAuthSeed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("links seeded staff and guardian accounts to Better Auth users", async () => {
    const runtime = await getApiRuntime(pgliteEnv);
    const application = await runtime.getSchoolApplication();
    const auth = runtime.getAuth();

    await runDevSeed(application);
    const result = await runDevAuthSeed(application, auth, pgliteEnv);

    expect(result.status).toBe("seeded");
    expect(result.linkedStaff).toBe(4);
    expect(result.linkedGuardians).toBe(1);

    const staff = await application.repositories.staffMembers.findById("st5");
    const guardian = await application.repositories.guardians.findById("g1");

    expect(staff?.subjectId).toBeTruthy();
    expect(guardian?.subjectId).toBeTruthy();

    const signInResponse = await auth.handler(new Request(`${pgliteEnv.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "c.moreau@school.edu",
        password: DEV_AUTH_PASSWORD,
      }),
    }));

    expect(signInResponse.status).toBe(200);

    const cookies = collectSetCookieHeaders(signInResponse);
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = pgliteEnv;
      await next();
    });
    app.use(async (c, next) => {
      c.set("schoolApp", application);
      await next();
    });
    app.use(createDependenciesInjection([
      createSessionActorDependency(() => auth as unknown as AuthSessionProvider),
    ]));
    app.get("/actor", c => c.json({ actor: c.get("actor") }));

    const actorResponse = await app.request("/actor", {
      headers: {
        cookie: cookies.join("; "),
      },
    });

    expect(actorResponse.status).toBe(200);

    const body = await actorResponse.json() as {
      actor: {
        kind: string;
        staffMemberId: string;
        subjectId: string;
      } | null;
    };

    expect(body.actor?.kind).toBe("staff");
    expect(body.actor?.staffMemberId).toBe("st5");
    expect(body.actor?.subjectId).toBe(staff?.subjectId);
  }, 30_000);

  it("re-provisions Better Auth users when domain links already exist", async () => {
    const runtime = await getApiRuntime(pgliteEnv);
    const application = await runtime.getSchoolApplication();
    const auth = runtime.getAuth();

    await runDevSeed(application);
    const firstRun = await runDevAuthSeed(application, auth, pgliteEnv);
    expect(firstRun.status).toBe("seeded");

    const secondRun = await runDevAuthSeed(application, auth, pgliteEnv);
    expect(secondRun.status).toBe("skipped");
    if (secondRun.status === "skipped") {
      expect(secondRun.reason).toBe("already-linked");
    }

    const signInResponse = await auth.handler(new Request(`${pgliteEnv.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "c.moreau@school.edu",
        password: DEV_AUTH_PASSWORD,
      }),
    }));

    expect(signInResponse.status).toBe(200);
  }, 30_000);

  it("is idempotent when auth links already exist", async () => {
    const runtime = await getApiRuntime(pgliteEnv);
    const application = await runtime.getSchoolApplication();
    const auth = runtime.getAuth();

    await runDevSeed(application);
    await runDevAuthSeed(application, auth, pgliteEnv);

    const secondRun = await runDevAuthSeed(application, auth, pgliteEnv);
    expect(secondRun.status).toBe("skipped");
    if (secondRun.status === "skipped") {
      expect(secondRun.reason).toBe("already-linked");
    }
  }, 30_000);
});
