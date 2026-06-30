import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding apply-structure-template route", () => {
  it("creates grade levels, classes, and curriculum from the template", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "structure@school.edu";
    const subjectId = await signUpAuthUser(runtime, {
      email,
      name: "Structure Owner",
    });
    const cookies = await signInThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        name: "Structure Test School",
        timeZone: "Europe/Paris",
        city: "Paris",
        country: "France",
      }),
    }));
    expect(registerResponse.status).toBe(200);
    const school = await registerResponse.json() as { id: string };

    const yearResponse = await app.request(createAppRequest("/core/commands/create-academic-year", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        id: "2025",
        schoolId: school.id,
        name: "2025 — 2026",
        startDate: "2025-09-01",
        endDate: "2026-07-03",
      }),
    }));
    expect(yearResponse.status).toBe(200);

    const response = await app.request(createAppRequest("/core/onboarding/apply-structure-template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        models: ["college"],
        levels: [
          { gradeLevelId: "gl-6", classCount: 2, capacity: 30 },
          { gradeLevelId: "gl-5", classCount: 1, capacity: 30 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as {
      gradeLevelCount: number;
      classGroupCount: number;
      subjectCount: number;
    };

    expect(summary.gradeLevelCount).toBe(2);
    expect(summary.classGroupCount).toBe(3);
    expect(summary.subjectCount).toBe(6);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    const schoolId = ownerStaff?.schoolId;
    expect(schoolId).toBeTruthy();

    const gradeLevels = (await application.repositories.gradeLevels.list()).filter(entry => entry.schoolId === schoolId);
    const classGroups = (await application.repositories.classGroups.list()).filter(entry => entry.schoolId === schoolId);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === schoolId);

    expect(gradeLevels).toHaveLength(2);
    expect(classGroups).toHaveLength(3);
    expect(subjects).toHaveLength(6);
    expect(classGroups.some(group => group.name === "6e A")).toBe(true);
    expect(classGroups.some(group => group.name === "6e B")).toBe(true);
  });
});
