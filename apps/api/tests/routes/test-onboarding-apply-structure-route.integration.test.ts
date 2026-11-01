import { describe, expect, it } from "bun:test";
import {
  createAppRequest,
  createCoreRouteTestApp,
  signInWithBearerThroughApp,
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
    const accessToken = await signInWithBearerThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
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
        "authorization": `Bearer ${accessToken}`,
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
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        templates: ["ci-college"],
        disciplineMappings: [{ subjectCode: "MATH", disciplineCode: "STALE", disciplineName: "Ignored wizard mapping" }],
        levels: [
          { gradeLevelId: "ci-college:4EME", classCount: 2, capacity: 30 },
          { gradeLevelId: "ci-college:3EME", classCount: 1, capacity: 30, classNamingMode: "alphabetical" },
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
    expect(summary.subjectCount).toBe(28);

    const ownerStaff = await application.repositories.staffMembers.findOne({ subjectId });
    const schoolId = ownerStaff?.schoolId;
    expect(schoolId).toBeTruthy();

    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === schoolId);
    const modules = (await application.repositories.reportModules.list()).filter(entry => entry.schoolId === schoolId);

    expect(modules.length).toBeGreaterThan(0);
    expect(modules.every(module => module.weightingMode === "subject_coefficients")).toBe(true);
    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(20);
    expect(gradeScales[0]?.ranges.map(row => row.letter)).toEqual(["TF", "F", "TI", "I", "P", "AB", "B", "TB", "EX"]);
    const disciplines = await application.repositories.academicDisciplines.list({ schoolId: school.id });
    expect(disciplines).toHaveLength(15);
    expect(disciplines.some(row => row.code === "STALE")).toBe(false);

    const academicPeriods = (await application.repositories.academicPeriods.list()).filter(entry => entry.schoolId === schoolId);
    expect(academicPeriods).toHaveLength(3);
    expect(academicPeriods.some(period => period.name === "Trimestre 1")).toBe(true);
    expect(academicPeriods.some(period => period.name === "Synthèse trimestrielle")).toBe(false);

    const gradeLevels = (await application.repositories.gradeLevels.list()).filter(entry => entry.schoolId === schoolId);
    const classGroups = (await application.repositories.classGroups.list()).filter(entry => entry.schoolId === schoolId);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === schoolId);
    const classSubjects = (await application.repositories.classSubjects.list()).filter(entry =>
      classGroups.some(group => group.id === entry.classGroupId));

    expect(gradeLevels).toHaveLength(2);
    expect(gradeLevels.map(level => level.id).sort()).toEqual(["gl-3", "gl-4"]);
    expect(gradeLevels.map(level => level.name).sort()).toEqual(["Quatrième", "Troisième"]);
    expect(gradeLevels.map(level => level.label).sort()).toEqual(["3ème", "4ème"]);
    expect(classGroups).toHaveLength(3);
    expect(subjects).toHaveLength(28);
    expect(classSubjects).toHaveLength(42);
    for (const offering of classSubjects) {
      const subject = subjects.find(entry => entry.id === offering.subjectId)!;
      const group = classGroups.find(entry => entry.id === offering.classGroupId)!;
      expect(subject.gradeLevelId).toBe(group.gradeLevelId);
      expect(subject.academicYearId).toBe(group.academicYearId);
    }
    expect(classGroups.map(group => group.name).sort()).toEqual(["3ème A", "4ème 1", "4ème 2"]);
  });

  it("applies built-in college template with longName curriculum entries", async () => {
    const { app, runtime, application } = await createCoreRouteTestApp();
    const email = "structure-ci@school.edu";
    await signUpAuthUser(runtime, {
      email,
      name: "CI Structure Owner",
    });
    const accessToken = await signInWithBearerThroughApp(app, { email });

    const registerResponse = await app.request(createAppRequest("/core/onboarding/register-school", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${accessToken}`,
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
        "authorization": `Bearer ${accessToken}`,
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
        "authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        templates: ["ci-college"],
        disciplineMappings: [{ subjectCode: "MATH", disciplineCode: "STALE", disciplineName: "Ignored wizard mapping" }],
        levels: [
          { gradeLevelId: "ci-college:6EME", classCount: 1, capacity: 30 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    const summary = await response.json() as { subjectCount: number; reportModuleCount: number };
    expect(summary.subjectCount).toBeGreaterThan(0);
    expect(summary.reportModuleCount).toBeGreaterThan(0);

    const modules = (await application.repositories.reportModules.list()).filter(entry => entry.schoolId === school.id);
    const gradeScales = (await application.repositories.gradeScales.list()).filter(entry => entry.schoolId === school.id);
    const subjects = (await application.repositories.subjects.list()).filter(entry => entry.schoolId === school.id);

    expect(modules.length).toBeGreaterThan(0);
    expect(modules.every(module => module.weightingMode === "subject_coefficients")).toBe(true);
    expect(gradeScales).toHaveLength(1);
    expect(gradeScales[0]?.maxScore).toBe(20);
    expect(gradeScales[0]?.ranges.map(row => row.letter)).toEqual(["TF", "F", "TI", "I", "P", "AB", "B", "TB", "EX"]);
    const disciplines = await application.repositories.academicDisciplines.list({ schoolId: school.id });
    expect(disciplines).toHaveLength(15);
    expect(disciplines.some(row => row.code === "STALE")).toBe(false);
    expect(subjects.some(subject => subject.name.includes("Français"))).toBe(true);
    expect(subjects.some(subject => subject.name.includes("Mathématiques"))).toBe(true);
  });
});
