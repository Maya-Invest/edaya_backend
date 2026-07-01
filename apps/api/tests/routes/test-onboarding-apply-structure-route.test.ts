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
        templates: ["fr-college"],
        levels: [
          { gradeLevelId: "fr-college:6EME", classCount: 2, capacity: 30 },
          { gradeLevelId: "fr-college:5EME", classCount: 1, capacity: 30 },
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

    const gradeLevels = (await application.repositories.gradeLevels.list()).filter(entry => entry.schoolId === schoolId);
    const classGroups = (await application.repositories.classGroups.list()).filter(entry => entry.schoolId === schoolId);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === schoolId);
    const gradeLevelSubjects = (await application.repositories.gradeLevelSubjects.list()).filter(entry =>
      gradeLevels.some(level => level.id === entry.gradeLevelId));
    const classSubjects = (await application.repositories.classSubjects.list()).filter(entry =>
      classGroups.some(group => group.id === entry.classGroupId));

    expect(gradeLevels).toHaveLength(2);
    expect(classGroups).toHaveLength(3);
    expect(subjects).toHaveLength(6);
    expect(gradeLevelSubjects).toHaveLength(12);
    expect(classSubjects).toHaveLength(18);
    expect(classSubjects.every(entry => entry.gradeLevelSubjectId)).toBe(true);
    expect(classGroups.some(group => group.name === "6e A")).toBe(true);
    expect(classGroups.some(group => group.name === "6e B")).toBe(true);
  });

  it("accepts template snapshots with shortName subjects and longName curriculum", async () => {
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
        templateSnapshots: [{
          id: "ci-primaire",
          countryCode: "CI",
          label: "Côte d'Ivoire — Primaire",
          description: "Primary Education in Ivory Coast (6 years)",
          cycle: "Primaire",
          reportCardStructure: {
            gradingScale: 10,
            passingGrade: 5,
            periods: [
              { code: "T1", name: "Trimestre 1", weight: 1 },
              { code: "T2", name: "Trimestre 2", weight: 1 },
              { code: "T3", name: "Trimestre 3", weight: 1 },
            ],
            domainCategories: [
              { domain: "Langues", label: "Langues", order: 1, coefficient: 1, weight: 2 },
              { domain: "Sciences", label: "Sciences", order: 2, coefficient: 1, weight: 2 },
            ],
          },
          gradeLevels: [{
            id: "ci-primaire:CP1",
            code: "CP1",
            name: "Cours Préparatoire 1ère année",
            shortLabel: "CP1",
            order: 1,
          }],
          subjects: [{
            code: "FR",
            shortName: "Français",
            domain: "Langues",
            defaultCoefficient: 1,
          }],
          curriculum: [{
            levelCodes: ["CP1"],
            subjectCode: "FR",
            longName: "Français — CP1 / CP2",
            coefficient: 1,
            matters: ["Lecture de mots simples"],
          }],
        }],
        levels: [
          { gradeLevelId: "ci-primaire:CP1", classCount: 1, capacity: 30 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as { subjectCount: number; reportCardDefinitionCount: number };
    expect(summary.subjectCount).toBe(1);
    expect(summary.reportCardDefinitionCount).toBe(1);

    const definitions = (await application.repositories.definitions.list()).filter(entry => entry.schoolId === school.id);
    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === school.id);
    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(10);
    expect(definitions).toHaveLength(1);
  });
});
