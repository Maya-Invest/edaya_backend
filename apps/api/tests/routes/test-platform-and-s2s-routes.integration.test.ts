import { S2S_API_KEY_PREFIX } from "@edaya/authorization";
import { SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  provisionServiceAccountForTests,
  seedDevSchoolAndAuthLinks,
  signInDirectorWithBearer,
  signInWithBearerThroughApp,
  testIdentityProvisioner,
  withAcademicYearHeaders,
} from "../support/core-route-harness";

const PLATFORM_OPERATOR_EMAIL = "platform.operator@edaya.test";
const SECOND_OPERATOR_EMAIL = "platform.second@edaya.test";
// These HTTP cases install migrations and seed a fresh embedded database.
const DATABASE_SETUP_TIMEOUT = 120_000;

function platformHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    "authorization": `Bearer ${token}`,
    "x-actor-kind": "platform",
    ...extra,
  };
}

async function signInPlatformOperator(app: Parameters<typeof signInWithBearerThroughApp>[0]) {
  await testIdentityProvisioner.ensureUser({
    email: PLATFORM_OPERATOR_EMAIL,
    password: "test-password",
    name: "Platform Operator",
  });
  return signInWithBearerThroughApp(app, { email: PLATFORM_OPERATOR_EMAIL });
}

describe("platform actor and s2s client routes", () => {
  it("bootstraps a platform operator and mints read/write S2S keys", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      env: { PLATFORM_BOOTSTRAP_EMAILS: PLATFORM_OPERATOR_EMAIL },
    });
    await seedDevSchoolAndAuthLinks(application, runtime, { includeAccessSeed: false });

    const token = await signInPlatformOperator(app);
    const me = await app.request(createAppRequest("/core/platform/me", {
      headers: platformHeaders(token),
    }));
    expect(me.status).toBe(200);
    const meBody = await me.json() as { kind: string; permissions: string[] };
    expect(meBody.kind).toBe("platform");
    expect(meBody.permissions.length).toBeGreaterThan(0);

    const listed = await app.request(createAppRequest("/core/platform-users", {
      headers: platformHeaders(token),
    }));
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as unknown[]).length).toBeGreaterThanOrEqual(1);

    await testIdentityProvisioner.ensureUser({
      email: SECOND_OPERATOR_EMAIL,
      password: "test-password",
      name: "Second Operator",
    });
    const createdOperator = await app.request(createAppRequest("/core/platform-users", {
      method: "POST",
      headers: platformHeaders(token, { "content-type": "application/json" }),
      body: JSON.stringify({ email: SECOND_OPERATOR_EMAIL }),
    }));
    expect(createdOperator.status).toBe(200);

    const createdRead = await app.request(createAppRequest("/core/s2s-clients", {
      method: "POST",
      headers: platformHeaders(token, { "content-type": "application/json" }),
      body: JSON.stringify({
        schoolId: SEED_SCHOOL_ID,
        clientId: "edaya-spark-read",
        accessClass: "read",
      }),
    }));
    expect(createdRead.status).toBe(200);
    const readBody = await createdRead.json() as { apiKey: string; id: string };
    expect(readBody.apiKey.startsWith(S2S_API_KEY_PREFIX)).toBe(true);

    const createdWrite = await app.request(createAppRequest("/core/s2s-clients", {
      method: "POST",
      headers: platformHeaders(token, { "content-type": "application/json" }),
      body: JSON.stringify({
        schoolId: SEED_SCHOOL_ID,
        clientId: "edaya-spark-write",
        accessClass: "write",
      }),
    }));
    expect(createdWrite.status).toBe(200);
    const writeBody = await createdWrite.json() as { apiKey: string };

    const readList = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${readBody.apiKey}`,
      }),
      body: JSON.stringify({}),
    }));
    expect(readList.status).toBe(200);

    const readWriteDenied = await app.request(createAppRequest("/core/entities/grade-levels/save", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${readBody.apiKey}`,
      }),
      body: JSON.stringify({
        id: "grade-level-s2s-read",
        schoolId: SEED_SCHOOL_ID,
        name: "S2S Read Grade",
        label: "SR",
        order: 99,
      }),
    }));
    expect(readWriteDenied.status).toBe(403);

    const writeSave = await app.request(createAppRequest("/core/entities/grade-levels/save", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${writeBody.apiKey}`,
      }),
      body: JSON.stringify({
        id: "grade-level-s2s-write",
        schoolId: SEED_SCHOOL_ID,
        name: "S2S Write Grade",
        label: "SW",
        order: 100,
      }),
    }));
    expect(writeSave.status).toBe(200);
    expect((await application.repositories.gradeLevels.findById("grade-level-s2s-write"))?.name).toBe("S2S Write Grade");

    const writeCannotMint = await app.request(createAppRequest("/core/s2s-clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${writeBody.apiKey}`,
      },
      body: JSON.stringify({
        schoolId: SEED_SCHOOL_ID,
        clientId: "should-fail",
        accessClass: "read",
      }),
    }));
    expect(writeCannotMint.status).toBe(401);

    const writeCannotCreateOperator = await app.request(createAppRequest("/core/platform-users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${writeBody.apiKey}`,
      },
      body: JSON.stringify({ email: "intruder@edaya.test" }),
    }));
    expect(writeCannotCreateOperator.status).toBe(401);

    const { apiKey } = await provisionServiceAccountForTests(application, {
      serviceId: "still-works",
      name: "Still Works",
      elevated: true,
    });
    const staffKeyList = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      }),
      body: JSON.stringify({}),
    }));
    expect(staffKeyList.status).toBe(200);

    const mixedCredentials = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${token}, Bearer ${readBody.apiKey}`,
      }),
      body: JSON.stringify({}),
    }));
    expect(mixedCredentials.status).toBe(401);

    const s2sIgnoresPlatformKind = await app.request(createAppRequest("/core/platform/me", {
      headers: {
        "authorization": `Bearer ${readBody.apiKey}`,
        "x-actor-kind": "platform",
      },
    }));
    expect(s2sIgnoresPlatformKind.status).toBe(401);

    const invalidS2s = await app.request(createAppRequest("/core/entities/students/list", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${S2S_API_KEY_PREFIX}invalid-token-16x`,
      },
      body: JSON.stringify({}),
    }));
    expect(invalidS2s.status).toBe(401);
  }, DATABASE_SETUP_TIMEOUT);

  it("keeps director JWT school access without X-Actor-Kind platform", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp({
      env: { PLATFORM_BOOTSTRAP_EMAILS: PLATFORM_OPERATOR_EMAIL },
    });
    await seedDevSchoolAndAuthLinks(application, runtime, { includeAccessSeed: false });
    const token = await signInDirectorWithBearer(app);
    const response = await app.request(createAppRequest("/core/entities/schools/list", {
      method: "POST",
      headers: withAcademicYearHeaders({
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
      }),
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(200);
    expect((await response.json() as { id: string }[]).map(school => school.id)).toEqual([SEED_SCHOOL_ID]);

    const platformDenied = await app.request(createAppRequest("/core/platform/me", {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(platformDenied.status).toBe(401);
  }, DATABASE_SETUP_TIMEOUT);
});
