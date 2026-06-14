import { afterEach, describe, expect, it } from "bun:test";
import indexRouter from "@/app-router";
import { dependenciesInjection } from "@/lib/http/dependencies";
import type { AppBindings } from "@/lib/http/types";
import { resetApiRuntimesForTests } from "@/lib/runtime/registry";
import { Hono } from "hono";
import {
  createAppRequest,
  createCoreRouteTestApp,
  createPgliteTestEnv,
  signInThroughApp,
  signUpAuthUser,
} from "../support/better-auth-route-harness";

describe("onboarding register-school route", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("registers a school and links the signed-in user as owner", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "owner@school.edu";
    const subjectId = await signUpAuthUser(runtime, {
      email,
      name: "Ada Owner",
    });
    const cookies = await signInThroughApp(app, { email });

    const response = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        name: "Bootstrap School",
        timeZone: "Europe/Paris",
      }),
    }));

    expect(response.status).toBe(200);

    const school = await response.json() as {
      id: string;
      name: string;
      ownerSubjectId?: string;
    };

    expect(school.id).toBeTruthy();
    expect(school.name).toBe("Bootstrap School");
    expect(school.ownerSubjectId).toBe(subjectId);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    expect(ownerStaff?.subjectId).toBe(subjectId);
    expect(ownerStaff?.schoolId).toBe(school.id);

    const grantsResponse = await app.request(createAppRequest("/core/authorization/effective-grants", {
      headers: {
        cookie: cookies.join("; "),
      },
    }));

    expect(grantsResponse.status).toBe(200);
    const grants = await grantsResponse.json() as {
      kind: string;
      effectiveGrants: { isElevated: boolean };
    };
    expect(grants.kind).toBe("staff");
    expect(grants.effectiveGrants.isElevated).toBe(true);
  });

  it("returns 503 when public school registration is disabled", async () => {
    const { runtime } = await createCoreRouteTestApp();
    const email = "blocked@school.edu";
    await signUpAuthUser(runtime, { email, name: "Blocked Owner" });

    const disabledEnv = createPgliteTestEnv({
      ALLOW_PUBLIC_SCHOOL_REGISTRATION: false,
    });
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = disabledEnv;
      await next();
    });
    app.use(dependenciesInjection);
    app.route("/", indexRouter);

    const cookies = await signInThroughApp(app, { email });

    const response = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        name: "Blocked School",
        timeZone: "UTC",
      }),
    }));

    expect(response.status).toBe(503);
  });

  it("returns 401 without a session", async () => {
    const { app } = await createCoreRouteTestApp();

    const response = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Anonymous School",
        timeZone: "UTC",
      }),
    }));

    expect(response.status).toBe(401);
  });
});
