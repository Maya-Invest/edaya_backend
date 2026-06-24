import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  createSessionActorDependency,
  grantServiceAccountCreate,
  provisionServiceAccountForTests,
  seedDevSchoolAndAuthLinks,
  signInDirector,
  signInThroughApp,
  wrapAuthWithVerifiedAssurance,
} from "../support/core-route-harness";
import type { AuthSessionProvider } from "@/http/dependencies/session-actor";
import {
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
} from "@edaya/dev-fixtures";
import { Permission, TEACHER_PERMISSIONS } from "@edaya/core";

describe("service account routes", () => {
  it("authenticates service accounts with API keys against /core/entities/schools/list", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const { apiKey } = await provisionServiceAccountForTests(application, {
      serviceId: "integration-seeding",
      displayName: "Integration Seeding",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
      elevated: true,
    });

    const response = await app.request(createAppRequest("/core/entities/schools/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(200);

    const schools = await response.json() as unknown[];
    expect(Array.isArray(schools)).toBe(true);
    expect(schools.length).toBeGreaterThanOrEqual(1);

    const persisted = await application.repositories.schools.findById(SEED_SCHOOL_ID);
    expect(persisted?.id).toBe(SEED_SCHOOL_ID);
  }, 30_000);

  it("returns 401 when the API key is invalid", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const response = await app.request(createAppRequest("/core/entities/schools/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer sk_live_invalid-token",
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(401);
  }, 30_000);

  it("returns 403 when the service account lacks entity read permission", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const { apiKey } = await provisionServiceAccountForTests(application, {
      serviceId: "narrow-teacher",
      displayName: "Teacher Integration",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st1],
    });

    const response = await app.request(createAppRequest("/core/entities/staff-members/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(403);
  }, 30_000);

  it("lists service accounts for verified human staff", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      sessionActor: createSessionActorDependency(async c =>
        wrapAuthWithVerifiedAssurance(c.var.auth as AuthSessionProvider)),
    });
    await seedDevSchoolAndAuthLinks(application, runtime);

    await provisionServiceAccountForTests(application, {
      serviceId: "listed-bot",
      displayName: "Listed Bot",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
    });

    const cookies = await signInDirector(app);
    const response = await app.request(createAppRequest("/core/service-accounts", {
      headers: {
        cookie: cookies.join("; "),
      },
    }));

    expect(response.status).toBe(200);

    const accounts = await response.json() as Array<{ serviceId: string }>;
    expect(accounts.some(account => account.serviceId === "listed-bot")).toBe(true);
  }, 30_000);

  it("creates a service account through the HTTP API and returns the API key once", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      sessionActor: createSessionActorDependency(async c =>
        wrapAuthWithVerifiedAssurance(c.var.auth as AuthSessionProvider)),
    });
    await seedDevSchoolAndAuthLinks(application, runtime);

    const cookies = await signInDirector(app);
    const response = await app.request(createAppRequest("/core/service-accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        serviceId: "http-created",
        displayName: "HTTP Created Bot",
        roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
      }),
    }));

    expect(response.status).toBe(200);

    const body = await response.json() as {
      serviceId: string;
      apiKey: string;
      accountKind: string;
    };

    expect(body.serviceId).toBe("http-created");
    expect(body.accountKind).toBe("service");
    expect(body.apiKey.startsWith("sk_live_")).toBe(true);

    const listResponse = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${body.apiKey}`,
      },
      body: JSON.stringify({}),
    }));

    expect(listResponse.status).toBe(200);
  }, 30_000);

  it("creates a service account with a caller-provided API key", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const cookies = await signInDirector(app);
    const customApiKey = "sk_live_custom-key-for-route-test-only";

    const response = await app.request(createAppRequest("/core/service-accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        serviceId: "custom-key-bot",
        displayName: "Custom Key Bot",
        roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
        apiKey: customApiKey,
      }),
    }));

    expect(response.status).toBe(200);

    const body = await response.json() as {
      serviceId: string;
      apiKey: string;
    };

    expect(body.serviceId).toBe("custom-key-bot");
    expect(body.apiKey).toBe(customApiKey);

    const listResponse = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${customApiKey}`,
      },
      body: JSON.stringify({}),
    }));

    expect(listResponse.status).toBe(200);
  }, 30_000);

  it("returns 403 when the creator delegates permissions they do not hold", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      sessionActor: createSessionActorDependency(async c =>
        wrapAuthWithVerifiedAssurance(c.var.auth as AuthSessionProvider)),
    });
    await seedDevSchoolAndAuthLinks(application, runtime);

    const teacherAccount = DEV_AUTH_STAFF_ACCOUNTS.find(account => account.staffId === "st2")!;
    const teacherStaffId = teacherAccount.staffId;
    await grantServiceAccountCreate(application, teacherStaffId, [
      Permission.SERVICE_ACCOUNT_CREATE,
      ...TEACHER_PERMISSIONS,
    ]);

    const cookies = await signInThroughApp(app, {
      email: teacherAccount.email,
    });

    const response = await app.request(createAppRequest("/core/service-accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        serviceId: "over-privileged-bot",
        displayName: "Over Privileged Bot",
        roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
      }),
    }));

    expect(response.status).toBe(403);
  }, 30_000);

  it("returns 403 when the service account lacks permission for a protected command", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const { apiKey } = await provisionServiceAccountForTests(application, {
      serviceId: "teacher-command-bot",
      displayName: "Teacher Command Bot",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st1],
    });

    const response = await app.request(createAppRequest("/core/commands/create-academic-year", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        id: "academic-year-403-test",
        schoolId: SEED_SCHOOL_ID,
        name: "2028",
        startDate: "2028-09-01",
        endDate: "2029-06-30",
      }),
    }));

    expect(response.status).toBe(403);
  }, 30_000);

  it("returns 403 when a human calls a service-only command", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      sessionActor: createSessionActorDependency(async c =>
        wrapAuthWithVerifiedAssurance(c.var.auth as AuthSessionProvider)),
    });
    await seedDevSchoolAndAuthLinks(application, runtime);

    const cookies = await signInDirector(app);
    const response = await app.request(createAppRequest("/core/commands/materialize-deliveries", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        announcementId: "announcement-1",
      }),
    }));

    expect(response.status).toBe(403);
  }, 30_000);

  it("updates a service account through the HTTP API", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      sessionActor: createSessionActorDependency(async c =>
        wrapAuthWithVerifiedAssurance(c.var.auth as AuthSessionProvider)),
    });
    await seedDevSchoolAndAuthLinks(application, runtime);

    const { staffMember } = await provisionServiceAccountForTests(application, {
      serviceId: "updatable-bot",
      displayName: "Updatable Bot",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st1],
    });

    const cookies = await signInDirector(app);
    const response = await app.request(createAppRequest(`/core/service-accounts/${staffMember.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        displayName: "Renamed Integration Bot",
      }),
    }));

    expect(response.status).toBe(200);

    const body = await response.json() as { displayName: string; serviceId: string };
    expect(body.serviceId).toBe("updatable-bot");
    expect(body.displayName).toBe("Renamed Integration Bot");
  }, 30_000);

  it("rejects service account management when session and API key are both present", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    await seedDevSchoolAndAuthLinks(application, runtime);

    const { apiKey } = await provisionServiceAccountForTests(application, {
      serviceId: "dual-auth",
      displayName: "Dual Auth Bot",
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
      elevated: true,
    });

    const cookies = await signInDirector(app);
    const response = await app.request(createAppRequest("/core/entities/schools/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(401);
  }, 30_000);
});
