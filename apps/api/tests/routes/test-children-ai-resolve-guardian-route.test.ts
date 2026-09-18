import { describe, expect, it } from "bun:test";
import { ClassGroup, GradeLevel, Guardian, GuardianStudentLink, School, Student, StudentClassEnrollment, StudentClassEnrollmentStatus } from "@edaya/core";
import { CHILDREN_AI_RESOLVE_SECRET_HEADER } from "@edaya/service";
import {
  createAppRequest,
  createCoreRouteTestApp,
} from "../support/core-route-harness";

const RESOLVE_PATH = "/internal/children-ai/resolve-guardian";

describe("children-ai resolve-guardian", () => {
  it("rejects a missing or wrong secret", async () => {
    const { app } = await createCoreRouteTestApp();
    const missing = await app.request(createAppRequest(RESOLVE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectId: "sub-parent" }),
    }));
    expect(missing.status).toBe(401);

    const wrong = await app.request(createAppRequest(RESOLVE_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CHILDREN_AI_RESOLVE_SECRET_HEADER]: "wrong-secret",
      },
      body: JSON.stringify({ subjectId: "sub-parent" }),
    }));
    expect(wrong.status).toBe(401);
  });

  it("returns linked students for a guardian subject", async () => {
    const { app, application, env } = await createCoreRouteTestApp();
    const schoolId = "sch-live-resolve";
    await application.repositories.schools.save(new School({
      id: schoolId,
      name: "Live School",
      timeZone: "Africa/Abidjan",
    }));

    await application.repositories.guardians.save(new Guardian({
      id: "gua-live",
      schoolId,
      firstName: "Awa",
      lastName: "Diallo",
      subjectId: "sub-parent-live",
    }));
    await application.repositories.students.save(new Student({
      id: "stu-live-1",
      schoolId,
      firstName: "Kofi",
      lastName: "Mensah",
    }));
    await application.repositories.guardianLinks.save(new GuardianStudentLink({
      id: "link-live",
      schoolId,
      guardianId: "gua-live",
      studentId: "stu-live-1",
    }));
    await application.repositories.gradeLevels.save(new GradeLevel({
      id: "gl-6",
      schoolId,
      name: "Sixième",
      label: "6ème",
      order: 6,
    }));
    await application.repositories.classGroups.save(new ClassGroup({
      id: "cls-6a",
      schoolId,
      academicYearId: "year-live",
      gradeLevelId: "gl-6",
      name: "6ème 1",
    }));
    await application.repositories.enrollments.save(new StudentClassEnrollment({
      id: "enr-live-1",
      studentId: "stu-live-1",
      classGroupId: "cls-6a",
      academicYearId: "year-live",
      enrollmentIndex: 1,
      status: StudentClassEnrollmentStatus.Active,
    }));

    const response = await app.request(createAppRequest(RESOLVE_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [CHILDREN_AI_RESOLVE_SECRET_HEADER]: env.CHILDREN_AI_RESOLVE_SECRET,
      },
      body: JSON.stringify({ subjectId: "sub-parent-live" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      schoolId,
      displayName: "Awa Diallo",
      children: [{
        studentId: "stu-live-1",
        schoolId,
        firstName: "Kofi",
        lastName: "Mensah",
        classLabel: "6ème 1",
        grade: "6e",
      }],
    });
  });
});
