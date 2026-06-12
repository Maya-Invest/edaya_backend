import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_DEADLINES,
  SEED_HOMEWORK_ASSIGNMENTS,
  SEED_HOMEWORK_SUBMISSIONS,
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

describe("dev homework seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("seeds homework assignments and submissions and exposes them via entity routes", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const seedResult = await runDevSeed(application);
    expect(seedResult.status).toBe("seeded");
    if (seedResult.status === "seeded") {
      expect(seedResult.homeworkAssignments).toBe(SEED_HOMEWORK_ASSIGNMENTS.length);
      expect(seedResult.homeworkSubmissions).toBe(SEED_HOMEWORK_SUBMISSIONS.length);
    }

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

    const [assignmentsResponse, submissionsResponse] = await Promise.all([
      app.request(createAppRequest("/core/entities/homework-assignments/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/homework-submissions/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ]);

    expect(assignmentsResponse.status).toBe(200);
    expect(submissionsResponse.status).toBe(200);

    const assignments = unwrapEntityList<{ id: string; classGroupId: string }>(await assignmentsResponse.json());
    const filteredAssignments = assignments.filter(assignment => assignment.classGroupId === "6a");
    const submissions = unwrapEntityList<{ homeworkAssignmentId: string; status: string }>(await submissionsResponse.json())
      .filter(submission => submission.homeworkAssignmentId === "d1");

    expect(assignments.length).toBe(SEED_DEADLINES.length);
    expect(filteredAssignments.length).toBe(SEED_DEADLINES.filter(deadline => deadline.classGroupId === "6a").length);
    expect(filteredAssignments.every(assignment => assignment.classGroupId === "6a")).toBe(true);
    expect(assignments.some(assignment => assignment.id === "d1")).toBe(true);
    expect(submissions.some(submission => submission.homeworkAssignmentId === "d1" && submission.status === "submitted")).toBe(true);
    expect(submissions.some(submission => submission.homeworkAssignmentId === "d1" && submission.status === "missing")).toBe(true);
  }, 30_000);
});
