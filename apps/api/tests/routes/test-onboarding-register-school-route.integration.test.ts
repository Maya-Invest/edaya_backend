import { requestReviewedOnboarding } from "../support/reviewed-onboarding-request";
import { describe, expect, it } from "bun:test";
import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/types";
import type { Environment } from "@/runtime/shared/env/schema";
import { Hono } from "hono";
import {
  createAppRequest,
  createCoreRouteTestApp,
  createCoreRouteTestDependencies,
  signInWithBearerThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding register-school route", () => {
  it("registers a school and links the signed-in user as owner", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "owner@school.edu";
    const subjectId = await signUpAuthUser(runtime, {
      email,
      name: "Ada Owner",
    });
    const accessToken = await signInWithBearerThroughApp(app, { email });

    const response = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
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
        authorization: `Bearer ${accessToken}`,
      },
    }));

    expect(grantsResponse.status).toBe(200);
    const grants = await grantsResponse.json() as {
      kind: string;
      grants: { source: string }[];
    };
    expect(grants.kind).toBe("staff");
    expect(grants.grants.length).toBeGreaterThan(0);
    expect(grants.grants.every(grant => grant.source === "owner")).toBe(true);

    const profilesResponse = await app.request(createAppRequest("/core/authorization/profiles", {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }));
    expect(profilesResponse.status).toBe(200);
    const profiles = await profilesResponse.json() as {
      profiles: Array<{
        kind: string;
        schoolId: string;
        actorId: string;
      }>;
    };
    expect(profiles.profiles).toEqual([
      expect.objectContaining({
        kind: "staff",
        schoolId: school.id,
        actorId: ownerStaff!.id,
      }),
    ]);

    const secondRegister = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: "Second School",
        timeZone: "UTC",
      }),
    }));
    expect(secondRegister.status).toBe(200);
    const second = await secondRegister.json() as { id: string; ownerSubjectId: string };
    expect(second.id).not.toBe(school.id);
    expect(second.ownerSubjectId).toBe(subjectId);
    for (const schoolId of [school.id, second.id]) {
      const scoped = await app.request(createAppRequest("/core/authorization/effective-grants", {
        headers: { "authorization": `Bearer ${accessToken}`, "x-actor-kind": "staff", "x-school-id": schoolId },
      }));
      expect(scoped.status).toBe(200);
      expect(await scoped.json()).toMatchObject({ schoolId, grants: expect.arrayContaining([expect.objectContaining({ source: "owner" })]) });
    }
  });

  it("lets the platform bootstrap owner register the first school", async () => {
    const email = "owner@school.edu";
    const { app, runtime } = await createCoreRouteTestApp({
      env: { PLATFORM_BOOTSTRAP_EMAILS: email },
    });
    await signUpAuthUser(runtime, { email, name: "Ada Owner" });
    const accessToken = await signInWithBearerThroughApp(app, { email });

    const response = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: "Bootstrap School",
        timeZone: "Europe/Paris",
      }),
    }));

    expect(response.status).toBe(200);
  });

  it("returns 503 when public school registration is disabled", async () => {
    const { runtime, env } = await createCoreRouteTestApp();
    const email = "blocked@school.edu";
    await signUpAuthUser(runtime, { email, name: "Blocked Owner" });

    const disabledEnv: Environment = {
      ...env,
      ALLOW_PUBLIC_SCHOOL_REGISTRATION: false,
    };
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = disabledEnv;
      await next();
    });
    app.use(createCoreRouteTestDependencies(runtime));
    app.route("/", indexRouter);

    const accessToken = await signInWithBearerThroughApp(app, { email });

    const response = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
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
