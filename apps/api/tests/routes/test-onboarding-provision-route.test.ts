import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInWithBearerThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

const typicalProvisionBody = {
  school: {
    name: "Lycée Test",
    timeZone: "Africa/Abidjan",
    city: "Abidjan",
    country: "Côte d'Ivoire",
    academicYearLabel: "2026-2027",
    academicYearStart: "2026-09-01",
    academicYearEnd: "2027-07-03",
    periodType: "trimester",
    periods: [{ label: "Trimestre 1", start: "2026-09-01", end: "2026-12-19" }],
  },
  structure: {
    templates: ["ci-college"],
    levels: [
      { gradeLevelId: "ci-college:4EME", classCount: 1, capacity: 30, classNamingMode: "numerical" },
    ],
  },
};

describe("onboarding provision route", () => {
  it("returns 422 for an empty body before authentication", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(422);
    const body = await response.json() as { success?: boolean };
    expect(body.success).toBe(false);
  });

  it("returns 422 for legacy template ids", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        ...typicalProvisionBody,
        structure: {
          templates: ["college"],
          levels: typicalProvisionBody.structure.levels,
        },
      }),
    }));
    expect(response.status).toBe(422);
  });

  it("returns 422 for an invalid staff invite email", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        ...typicalProvisionBody,
        invites: [{ email: "not-an-email", role: "secretary" }],
      }),
    }));
    expect(response.status).toBe(422);
  });

  it("provisions a school from the full onboarding draft and replays the same request", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "provision-owner@school.edu";
    const subjectId = await signUpAuthUser(runtime, {
      email,
      name: "Provision Owner",
    });
    const accessToken = await signInWithBearerThroughApp(app, { email });
    const schoolId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const body = JSON.stringify({
      schoolId,
      requestId,
      ...typicalProvisionBody,
    });

    const response = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body,
    }));

    const payload = await response.json() as {
      message?: string;
      schoolId?: string;
      yearId?: string;
      periodId?: string;
      structure?: { gradeLevelCount: number; classGroupCount: number } | null;
      status?: { wizardCompleted: boolean };
      phases?: Array<{ phase: string }>;
      replayed?: boolean;
    };
    if (response.status !== 200) {
      throw new Error(`expected 200, got ${response.status}: ${JSON.stringify(payload)}`);
    }
    expect(response.status).toBe(200);
    expect(payload.schoolId).toBe(schoolId);
    expect(payload.yearId).toBeTruthy();
    expect(payload.periodId).toBeTruthy();
    expect(payload.structure?.gradeLevelCount).toBe(1);
    expect(payload.structure?.classGroupCount).toBe(1);
    expect(payload.status?.wizardCompleted).toBe(true);
    expect(payload.phases?.length).toBeGreaterThan(0);
    expect(payload.replayed).toBeFalsy();

    const replay = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body,
    }));
    const replayed = await replay.json() as typeof payload;
    expect(replay.status).toBe(200);
    expect(replayed.schoolId).toBe(schoolId);
    expect(replayed.replayed).toBe(true);

    const conflict = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        schoolId,
        requestId,
        ...typicalProvisionBody,
        school: {
          ...typicalProvisionBody.school,
          name: "Changed School",
        },
      }),
    }));
    expect(conflict.status).toBeGreaterThanOrEqual(400);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    expect(ownerStaff?.schoolId).toBe(payload.schoolId);
    expect(ownerStaff?.onboardingWizardCompletedAt).toBeTruthy();
    expect(await application.repositories.staffMembers.count({ schoolId })).toBe(1);
  });
});
