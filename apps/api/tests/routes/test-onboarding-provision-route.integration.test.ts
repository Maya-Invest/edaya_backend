import { requestReviewedOnboarding } from "../support/reviewed-onboarding-request";
import { resolveOnboardingDataset } from "@edaya/fixtures/onboarding";
import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInPhoneWithBearerForTests,
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
  it("provisions and bootstraps school grants for a verified phone-only account", async () => {
    const { app } = await createCoreRouteTestApp();
    const accessToken = await signInPhoneWithBearerForTests("+2250700000042");
    const schoolId = crypto.randomUUID();
    const headers = { "content-type": "application/json", "authorization": `Bearer ${accessToken}` };
    const provision = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers,
      body: JSON.stringify({ schoolId, requestId: crypto.randomUUID(), ...typicalProvisionBody }),
    }));
    expect(provision.status).toBe(200);
    const profiles = await app.request(createAppRequest("/core/authorization/profiles", { headers }));
    const { profiles: memberships } = await profiles.json() as { profiles: Array<{ actorId: string; schoolId: string; kind: string }> };
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ kind: "staff", schoolId });
    const grants = await app.request(createAppRequest("/core/authorization/effective-grants", {
      headers: { ...headers, "x-actor-kind": "staff", "x-actor-id": memberships[0]!.actorId, "x-school-id": schoolId },
    }));
    expect(grants.status).toBe(200);
    expect(await grants.json()).toMatchObject({ kind: "staff", schoolId, assuranceLevel: "verified" });
  });

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

  it("returns 422 for obsolete custom snapshots", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        ...typicalProvisionBody,
        structure: {
          templates: ["ci-college"],
          templateSnapshots: [],
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

    const response = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/provision", {
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

    const replay = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/provision", {
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

    const conflict = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/provision", {
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

describe("canonical onboarding request contracts", () => {
  it("rejects ambiguous selection and obsolete custom snapshots during request validation", async () => {
    const { app } = await createCoreRouteTestApp();
    for (const selection of [
      { dataset: { id: "ci-general-secondary", version: "1.0.0" }, datasetSnapshot: resolveOnboardingDataset("ci-general-secondary", "1.0.0") },
      { templateSnapshots: [] },
    ]) {
      const response = await app.request(createAppRequest("/core/onboarding/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId: crypto.randomUUID(), requestId: crypto.randomUUID(), ...typicalProvisionBody, structure: { ...typicalProvisionBody.structure, ...selection } }),
      }));
      expect(response.status).toBe(422);
    }
  });

  it("rejects unknown dataset versions and template selections before creating a school", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "dataset-validation@school.edu";
    await signUpAuthUser(runtime, { email, name: "Dataset Owner" });
    const token = await signInWithBearerThroughApp(app, { email });
    for (const selection of [
      { dataset: { id: "ci-general-secondary", version: "9.9.9" } },
      { templates: ["unknown-template"] },
    ]) {
      const schoolId = crypto.randomUUID();
      const response = await app.request(createAppRequest("/core/onboarding/provision", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
        body: JSON.stringify({ schoolId, requestId: crypto.randomUUID(), ...typicalProvisionBody, structure: { ...typicalProvisionBody.structure, ...selection } }),
      }));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(await application.repositories.schools.findById(schoolId)).toBeUndefined();
    }
  });

  it("provisions a canonical custom dataset without CI template IDs and preserves semesters", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "custom-dataset@school.edu";
    await signUpAuthUser(runtime, { email, name: "Custom Dataset Owner" });
    const token = await signInWithBearerThroughApp(app, { email });
    const datasetSnapshot = resolveOnboardingDataset("ci-general-secondary", "1.0.0");
    datasetSnapshot.id = "custom-secondary";
    datasetSnapshot.templates = [datasetSnapshot.templates[0]!];
    const template = datasetSnapshot.templates[0]!;
    template.id = "custom-college";
    for (const level of template.gradeLevels) level.id = `${template.id}:${level.code}`;
    const schoolId = crypto.randomUUID();
    const response = await requestReviewedOnboarding(app, createAppRequest("/core/onboarding/provision", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
      body: JSON.stringify({
        schoolId,
        requestId: crypto.randomUUID(),
        school: { ...typicalProvisionBody.school, periodType: "semester", periods: [{ label: "Semestre 1", start: "2026-09-01", end: "2027-01-31" }, { label: "Semestre 2", start: "2027-02-01", end: "2027-07-03" }] },
        structure: { datasetSnapshot, templates: [template.id], levels: [{ gradeLevelId: `${template.id}:4EME`, classCount: 1, capacity: 30 }] },
      }),
    }));
    expect(response.status).toBe(200);
    const periods = await application.repositories.academicPeriods.list({ schoolId });
    expect(periods).toHaveLength(2);
    expect(periods.every(period => period.type === "semester")).toBe(true);
    const scales = await application.repositories.gradeScales.list({ schoolId });
    expect(scales).toHaveLength(1);
    expect(scales[0]!.findRange(18)?.interpretation).toBe("Excellent");
  });
});
