import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITIONS,
  SEED_REPORT_CARD_RESULTS,
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

function unwrapEntity<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map(entry => unwrapEntity(entry)) as T;
  }
  if (value && typeof value === "object" && "data" in value && value.data && typeof value.data === "object") {
    const record = value as Record<string, unknown>;
    const merged: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record.data as Record<string, unknown>)) {
      merged[key] = unwrapEntity(entry);
    }
    for (const [key, entry] of Object.entries(record)) {
      if (key === "data") {
        continue;
      }
      merged[key] = unwrapEntity(entry);
    }
    return merged as T;
  }
  return value as T;
}

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(entry => unwrapEntity<T>(entry));
}

const expectedSectionCount = SEED_REPORT_CARD_DEFINITIONS.reduce((total, definition) => {
  return total + definition.sections.reduce((sectionTotal, section) => {
    return sectionTotal + 1 + section.subjectIds.length;
  }, 0);
}, 0);

const pgliteEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "development",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "pglite",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("dev report cards seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("seeds grade scales, report card definitions and results and lets staff list report-card entities", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const seedResult = await runDevSeed(application);
    expect(seedResult.status).toBe("seeded");
    if (seedResult.status === "seeded") {
      expect(seedResult.gradeScales).toBe(SEED_GRADE_SCALES.length);
      expect(seedResult.reportCardDefinitions).toBe(SEED_REPORT_CARD_DEFINITIONS.length);
      expect(seedResult.reportCardSections).toBe(expectedSectionCount);
      expect(seedResult.reportCardResults).toBe(SEED_REPORT_CARD_RESULTS.length);
    }

    await runDevAuthSeed(application, runtime.getAuth(), pgliteEnv);
    await runDevAccessSeed(application);

    const signIn = await app.request(createAppRequest("/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }));
    const cookies = collectSetCookieHeaders(signIn);
    const authHeaders = {
      "content-type": "application/json",
      "cookie": cookies.join("; "),
    };

    const [gradeScalesResponse, definitionsResponse, sectionsResponse, resultsResponse] = await Promise.all([
      app.request(createAppRequest("/core/entities/grade-scales/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/definitions/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/sections/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/results/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ]);

    expect(gradeScalesResponse.status).toBe(200);
    expect(definitionsResponse.status).toBe(200);
    expect(sectionsResponse.status).toBe(200);
    expect(resultsResponse.status).toBe(200);

    const gradeScales = unwrapEntityList<{ id: string; name: string }>(await gradeScalesResponse.json());
    const definitions = unwrapEntityList<{ id: string; name: string }>(await definitionsResponse.json());
    const sections = unwrapEntityList<{ id: string; reportCardDefinitionId: string }>(await sectionsResponse.json());
    const results = unwrapEntityList<{ id: string; studentId: string }>(await resultsResponse.json());

    expect(gradeScales.length).toBeGreaterThanOrEqual(SEED_GRADE_SCALES.length);
    expect(definitions.length).toBeGreaterThanOrEqual(SEED_REPORT_CARD_DEFINITIONS.length);
    expect(sections.length).toBeGreaterThanOrEqual(expectedSectionCount);
    expect(results.length).toBeGreaterThanOrEqual(SEED_REPORT_CARD_RESULTS.length);
    expect(gradeScales.some(scale => scale.id === "gs-20")).toBe(true);
    expect(definitions.some(definition => definition.id === "rcd-ms-6")).toBe(true);
    expect(definitions.some(definition => definition.id === "rcd-term")).toBe(true);
    expect(definitions.some(definition => definition.id === "rcd-ms-draft")).toBe(true);
    expect(results.some(result => result.id === "rcr-s1-t3" && result.studentId === "s1")).toBe(true);
    expect(results.some(result => result.id === "rcr-s9-t3" && result.studentId === "s9")).toBe(true);
  }, 30_000);
});
