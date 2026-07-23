import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInThroughApp,
  signUpAuthUser,
} from "../support/core-route-harness";

describe("onboarding structure templates route", () => {
  it("lists CI templates by default and returns an empty list for unsupported countries", async () => {
    const { app } = await createCoreRouteTestApp();

    const defaultResponse = await app.request(createAppRequest("/core/onboarding/structure-templates", {
      method: "GET",
    }));
    expect(defaultResponse.status).toBe(200);
    const defaultPayload = await defaultResponse.json() as {
      countryCode: string;
      templates: Array<{ id: string }>;
    };
    expect(defaultPayload.countryCode).toBe("CI");
    expect(defaultPayload.templates.map(template => template.id)).toEqual([
      "ci-primaire",
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
    expect(summary.subjectCount).toBe(4);

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
    expect(sections.some(section => section.role === "synthese")).toBe(true);
    expect(sections.some(section => section.role === "appreciation")).toBe(true);

    const academicPeriods = (await application.repositories.academicPeriods.list()).filter(entry => entry.schoolId === schoolId);
    expect(academicPeriods).toHaveLength(4);
    expect(academicPeriods.some(period => period.name === "Trimestre 1")).toBe(true);
    expect(academicPeriods.some(period => period.name === "Synthèse trimestrielle")).toBe(true);

    const gradeLevels = (await application.repositories.gradeLevels.list()).filter(entry => entry.schoolId === schoolId);
    const classGroups = (await application.repositories.classGroups.list()).filter(entry => entry.schoolId === schoolId);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === schoolId);
    const gradeLevelSubjects = (await application.repositories.gradeLevelSubjects.list()).filter(entry =>
      gradeLevels.some(level => level.id === entry.gradeLevelId));
    const classSubjects = (await application.repositories.classSubjects.list()).filter(entry =>
      classGroups.some(group => group.id === entry.classGroupId));

    expect(gradeLevels).toHaveLength(2);
    expect(gradeLevels.map(level => level.id).sort()).toEqual(["gl-3", "gl-4"]);
    expect(gradeLevels.map(level => level.name).sort()).toEqual(["3ème", "4ème"]);
    expect(classGroups).toHaveLength(3);
    expect(classGroups.map(group => group.id).sort()).toEqual(["3a", "4a", "4b"]);
    expect(subjects).toHaveLength(4);
    expect(gradeLevelSubjects).toHaveLength(8);
    expect(classSubjects).toHaveLength(12);
    expect(classSubjects.every(entry => entry.gradeLevelSubjectId)).toBe(true);
    expect(classGroups.some(group => group.name === "4e A")).toBe(true);
    expect(classGroups.some(group => group.name === "4e B")).toBe(true);
  });

  it("applies built-in primaire templates with longName curriculum entries", async () => {
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
        templates: ["ci-primaire"],
        levels: [
          { gradeLevelId: "ci-primaire:CP1", classCount: 1, capacity: 30 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as { subjectCount: number; reportCardDefinitionCount: number };
    expect(summary.subjectCount).toBe(2);
    expect(summary.reportCardDefinitionCount).toBe(1);

    const definitions = (await application.repositories.definitions.list()).filter(entry => entry.schoolId === school.id);
    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === school.id);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === school.id);
    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(10);
    expect(definitions).toHaveLength(1);
    expect(subjects.some(subject => subject.name === "Français — CP1/CP2")).toBe(true);
    expect(subjects.some(subject => subject.name === "Mathématiques — CP1/CP2")).toBe(true);
  });
});
