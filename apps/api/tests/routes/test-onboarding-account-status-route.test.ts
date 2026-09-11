import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInWithBearerThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding account status route", () => {
  it("marks wizard complete and returns account status", async () => {
    const { app, runtime } = await createCoreRouteTestApp();
    const email = "onboarding-status@school.edu";
    await signUpAuthUser(runtime, {
      email,
      name: "Status Owner",
    });
    const accessToken = await signInWithBearerThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: "Status Test School",
        timeZone: "Europe/Paris",
        city: "Paris",
        country: "France",
      }),
    }));
    expect(registerResponse.status).toBe(200);

    const yearResponse = await app.request(createAppRequest("/core/commands/create-academic-year", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        id: "2025",
        schoolId: (await registerResponse.json() as { id: string }).id,
        name: "2025 — 2026",
        startDate: "2025-09-01",
        endDate: "2026-07-03",
      }),
    }));
    expect(yearResponse.status).toBe(200);

    const statusBefore = await app.request(createAppRequest("/core/onboarding/account-status", {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }));
    expect(statusBefore.status).toBe(200);
    const before = await statusBefore.json() as {
      wizardCompleted: boolean;
      maxReachedStep: number;
      schoolStepSubmitted: boolean;
    };
    expect(before.wizardCompleted).toBe(false);
    expect(before.schoolStepSubmitted).toBe(true);
    expect(before.maxReachedStep).toBeGreaterThanOrEqual(2);

    const completeResponse = await app.request(createAppRequest("/core/onboarding/complete-wizard", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    }));
    expect(completeResponse.status).toBe(200);
    const after = await completeResponse.json() as {
      wizardCompleted: boolean;
      maxReachedStep: number;
    };
    expect(after.wizardCompleted).toBe(true);
    expect(after.maxReachedStep).toBe(4);
  });
});
