import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_FEES,
  SEED_PAYMENTS,
  SEED_STUDENT_FEES,
} from "@edaya/dev-fixtures";
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

import { pgliteEnv } from "../support/pglite-env";

describe("dev finance seed", () => {
  afterEach(async () => {
    await resetApiRuntimesForTests();
  });

  it("seeds fees, student fees, payments and lets the director list finance entities", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const seedResult = await runDevSeed(application);
    expect(seedResult.status).toBe("seeded");
    if (seedResult.status === "seeded") {
      expect(seedResult.fees).toBe(SEED_FEES.length);
      expect(seedResult.studentFees).toBe(SEED_STUDENT_FEES.length);
      expect(seedResult.payments).toBe(SEED_PAYMENTS.length);
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

    const [feesResponse, studentFeesResponse, paymentsResponse] = await Promise.all([
      app.request(createAppRequest("/core/entities/fees/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/student-fees/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest("/core/entities/payments/list", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ]);

    expect(feesResponse.status).toBe(200);
    expect(studentFeesResponse.status).toBe(200);
    expect(paymentsResponse.status).toBe(200);

    const fees = unwrapEntityList<{ name: string }>(await feesResponse.json());
    const studentFees = unwrapEntityList<{ studentId: string }>(await studentFeesResponse.json());
    const payments = unwrapEntityList<{ studentFeeId: string }>(await paymentsResponse.json());

    expect(fees.length).toBeGreaterThanOrEqual(SEED_FEES.length);
    expect(studentFees.length).toBeGreaterThanOrEqual(SEED_STUDENT_FEES.length);
    expect(payments.length).toBeGreaterThanOrEqual(SEED_PAYMENTS.length);
    expect(fees.some(fee => fee.name === "Tuition — Middle School")).toBe(true);
    expect(studentFees.some(fee => fee.studentId === "s1")).toBe(true);
    expect(studentFees.some(fee => fee.studentId === "s9")).toBe(true);
    expect(payments.some(payment => payment.studentFeeId === "b1")).toBe(true);
    expect(payments.some(payment => payment.studentFeeId === "b7")).toBe(true);
  }, 30_000);
});
