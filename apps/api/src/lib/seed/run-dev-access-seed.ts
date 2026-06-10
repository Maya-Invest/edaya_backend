import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import {
  SEED_ACADEMIC_YEAR_ID,
  SEED_SCHOOL_ID,
} from "@/lib/seed/dataset";
import {
  AccessRole,
  COORDINATOR_PERMISSIONS,
  Permission,
  StaffAssignment,
  StaffRoleAssignment,
  TEACHER_PERMISSIONS,
} from "@edaya/core";

const EDUCATOR_PERMISSIONS = [
  Permission.DISCIPLINE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.DISCIPLINE_UPDATE,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_JUSTIFY,
  Permission.CLASS_LOGBOOK_READ,
  Permission.GRADE_READ,
  Permission.STUDENT_READ,
] as const;

export type DevAccessSeedResult =
  | { status: "skipped"; reason: "school-not-seeded" | "already-seeded" }
  | { status: "seeded"; roles: number; assignments: number; staffAssignments: number };

export async function runDevAccessSeed(application: ApiSchoolApplication): Promise<DevAccessSeedResult> {
  const school = await application.repositories.schools.findById(SEED_SCHOOL_ID);
  if (!school) {
    return { status: "skipped", reason: "school-not-seeded" };
  }

  const existingRole = await application.repositories.accessRoles?.findById("role-teacher");
  if (existingRole) {
    return { status: "skipped", reason: "already-seeded" };
  }

  await application.repositories.accessRoles.save(new AccessRole({
    id: "role-teacher",
    schoolId: SEED_SCHOOL_ID,
    name: "Teacher",
    permissions: [...TEACHER_PERMISSIONS, Permission.GRADE_READ, Permission.STUDENT_READ],
  }));

  await application.repositories.accessRoles.save(new AccessRole({
    id: "role-coordinator",
    schoolId: SEED_SCHOOL_ID,
    name: "Lead teacher",
    permissions: [...COORDINATOR_PERMISSIONS, Permission.REPORT_CARD_CONFIGURE, Permission.REPORT_CARD_GENERATE],
  }));

  await application.repositories.accessRoles.save(new AccessRole({
    id: "role-educator",
    schoolId: SEED_SCHOOL_ID,
    name: "Educator",
    permissions: [...EDUCATOR_PERMISSIONS],
  }));

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: "sra-st1",
    staffId: "st1",
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ["role-teacher"],
    scopeGrants: [],
    status: "active",
  }));

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: "sra-st3",
    staffId: "st3",
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ["role-coordinator"],
    scopeGrants: [],
    status: "active",
  }));

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: "sra-st7",
    staffId: "st7",
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ["role-educator"],
    scopeGrants: [
      {
        permission: Permission.DISCIPLINE_CREATE,
        scopeType: "school",
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
      {
        permission: Permission.ATTENDANCE_RECORD,
        scopeType: "school",
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
    ],
    status: "active",
  }));

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: "sa-st1-6a",
    staffId: "st1",
    responsibility: "Mathematics",
    classGroupId: "6a",
  }));

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: "sa-st1-5a",
    staffId: "st1",
    responsibility: "Mathematics",
    classGroupId: "5a",
  }));

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: "sa-st3-6a",
    staffId: "st3",
    responsibility: "Homeroom",
    classGroupId: "6a",
  }));

  return {
    status: "seeded",
    roles: 3,
    assignments: 3,
    staffAssignments: 3,
  };
}
