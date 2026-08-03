import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding structure templates route", () => {
  it("lists CI templates for Ivory Coast and returns empty for unsupported countries", async () => {
    const { app } = await createCoreRouteTestApp();

    const defaultResponse = await app.request(createAppRequest("/core/onboarding/structure-templates", {
      method: "GET",
    }));
    expect(defaultResponse.status).toBe(200);
    const defaultPayload = await defaultResponse.json() as {
      countryCode: string;
      templates: Array<{ id: string }>;
    };
    expect(defaultPayload.countryCode).toBe("FR");
    expect(defaultPayload.templates).toHaveLength(0);

    const ciResponse = await app.request(createAppRequest(
      `/core/onboarding/structure-templates?country=${encodeURIComponent("Côte d'Ivoire")}`,
      { method: "GET" },
    ));
    expect(ciResponse.status).toBe(200);
    const ciPayload = await ciResponse.json() as {
      countryCode: string;
      templates: Array<{ id: string }>;
    };
    expect(ciPayload.countryCode).toBe("CI");
    expect(ciPayload.templates.map(template => template.id)).toEqual([
      "ci-college",
      "ci-lycee",
    ]);

    const franceResponse = await app.request(createAppRequest("/core/onboarding/structure-templates?country=France", {
      method: "GET",
    }));
    expect(franceResponse.status).toBe(200);
    const francePayload = await franceResponse.json() as {
      countryCode: string;
      templates: unknown[];
    };
    expect(francePayload.countryCode).toBe("FR");
    expect(francePayload.templates).toHaveLength(0);

    const senegalResponse = await app.request(createAppRequest(
      `/core/onboarding/structure-templates?country=${encodeURIComponent("Sénégal")}`,
      { method: "GET" },
    ));
    expect(senegalResponse.status).toBe(200);
    const senegalPayload = await senegalResponse.json() as {
      countryCode: string;
      templates: unknown[];
    };
    expect(senegalPayload.countryCode).toBe("FR");
    expect(senegalPayload.templates).toHaveLength(0);
  });
});

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
        timeZone: "Africa/Abidjan",
        city: "Abidjan",
        country: "Côte d'Ivoire",
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
        templates: ["ci-college"],
        levels: [
          { gradeLevelId: "ci-college:4EME", classCount: 2, capacity: 30 },
          { gradeLevelId: "ci-college:3EME", classCount: 1, capacity: 30 },
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
    expect(summary.subjectCount).toBe(14);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    const schoolId = ownerStaff?.schoolId;
    expect(schoolId).toBeTruthy();

    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === schoolId);
    const definitions = (await application.repositories.definitions.list()).filter(entry => entry.schoolId === schoolId);
    const sections = (await application.repositories.sections.list()).filter(entry =>
      definitions.some(definition => definition.id === entry.reportCardDefinitionId));

    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(20);
    expect(definitions).toHaveLength(2);
    expect(definitions.every(definition => definition.isDefault)).toBe(true);
    expect(sections.length).toBeGreaterThan(10);
    expect(sections.some(section => section.role === "matieres")).toBe(true);
    expect(sections.some(section => section.role === "synthese")).toBe(false);
    expect(sections.some(section => section.name === "Bilan Lettre")).toBe(true);
    expect(sections.some(section => section.name === "Bilan Science")).toBe(true);
    expect(sections.some(section => section.name === "Bilan autres")).toBe(true);
    expect(sections.some(section => section.role === "appreciation")).toBe(true);

    const academicPeriods = (await application.repositories.academicPeriods.list()).filter(entry => entry.schoolId === schoolId);
    expect(academicPeriods).toHaveLength(3);
    expect(academicPeriods.some(period => period.name === "Trimestre 1")).toBe(true);
    expect(academicPeriods.some(period => period.name === "Synthèse trimestrielle")).toBe(false);

    const gradeLevels = (await application.repositories.gradeLevels.list()).filter(entry => entry.schoolId === schoolId);
    const classGroups = (await application.repositories.classGroups.list()).filter(entry => entry.schoolId === schoolId);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === schoolId);
    const gradeLevelSubjects = (await application.repositories.gradeLevelSubjects.list()).filter(entry =>
      gradeLevels.some(level => level.id === entry.gradeLevelId));
    const classSubjects = (await application.repositories.classSubjects.list()).filter(entry =>
      classGroups.some(group => group.id === entry.classGroupId));

    expect(gradeLevels).toHaveLength(2);
    expect(gradeLevels.map(level => level.id).sort()).toEqual(["gl-3", "gl-4"]);
    expect(gradeLevels.map(level => level.name).sort()).toEqual(["Quatrième", "Troisième"]);
    expect(classGroups).toHaveLength(3);
    expect(subjects).toHaveLength(14);
    expect(gradeLevelSubjects).toHaveLength(28);
    expect(classSubjects).toHaveLength(42);
    expect(classSubjects.every(entry => entry.gradeLevelSubjectId)).toBe(true);
    expect(classGroups.some(group => group.name === "4EME 1")).toBe(true);
    expect(classGroups.some(group => group.name === "4EME 2")).toBe(true);
  });

  it("applies built-in college template with longName curriculum entries", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "structure-ci@school.edu";
    await signUpAuthUser(runtime, {
      email,
      name: "CI Structure Owner",
    });
    const cookies = await signInThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cookie": cookies.join("; "),
      },
      body: JSON.stringify({
        name: "CI Structure Test School",
        timeZone: "Africa/Abidjan",
        city: "Abidjan",
        country: "Côte d'Ivoire",
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
        templates: ["ci-college"],
        levels: [
          { gradeLevelId: "ci-college:6EME", classCount: 1, capacity: 30 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as { subjectCount: number; reportCardDefinitionCount: number };
    expect(summary.subjectCount).toBeGreaterThan(0);
    expect(summary.reportCardDefinitionCount).toBe(1);

    const definitions = (await application.repositories.definitions.list()).filter(entry => entry.schoolId === school.id);
    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === school.id);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === school.id);
    const sections = (await application.repositories.sections.list()).filter(entry =>
      definitions.some(definition => definition.id === entry.reportCardDefinitionId),
    );
    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(20);
    expect(definitions).toHaveLength(1);
    expect(subjects.some(subject => subject.name.includes("Français"))).toBe(true);
    expect(subjects.some(subject => subject.name.includes("Mathématiques"))).toBe(true);
    expect(sections.some(section => section.name === "Bilan Lettre")).toBe(true);
    expect(sections.some(section => section.name === "Bilan Science")).toBe(true);
    expect(sections.some(section => section.name === "Bilan autres")).toBe(true);
    expect(sections.some(section => section.name === "Appréciations")).toBe(true);
    expect(sections.some(section => section.name.includes("Synthèse"))).toBe(false);
  });
});
