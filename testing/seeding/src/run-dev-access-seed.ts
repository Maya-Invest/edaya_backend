import type { SeedApplication } from './types'
import {
  AccessRole,
  COORDINATOR_PERMISSIONS,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  StaffAssignment,
  StaffRoleAssignment,
  TEACHER_PERMISSIONS,
} from '@edaya/core'
import {
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASS_SUBJECTS,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'

/** Entity list endpoints used by the webapp shell loaders. */
const DEV_WEBAPP_SHELL_READ_PERMISSIONS = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
] as const

/** Entity list endpoints used by students/guardians pages. */
const DEV_WEBAPP_PEOPLE_READ_PERMISSIONS = [
  Permission.QUERY_STUDENT_DIRECTORY_READ,
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.STUDENT_READ,
  Permission.PARENT_READ,
] as const

/** Entity list endpoints used by the staff configuration page. */
const DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS = [
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
  Permission.ACCESS_CONTROL_READ,
  Permission.STAFF_READ,
] as const

/** Entity list endpoints used by finance pages (`/finance/fees`, billing, payments). */
const DEV_WEBAPP_FINANCE_READ_PERMISSIONS = [
  Permission.FINANCIAL_CONFIG_READ,
  Permission.PAYMENT_READ,
] as const

/** Entity list endpoints used by timetable / planning pages. */
const DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS = [
  Permission.QUERY_TIMETABLE_READ,
  Permission.RESOURCE_READ,
] as const

/** Entity list endpoints used by class evaluations pages. */
const DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS = [
  Permission.GRADE_READ,
] as const

/** Entity list endpoints used by school calendar pages. */
const DEV_WEBAPP_CALENDAR_READ_PERMISSIONS = [
  Permission.QUERY_CALENDAR_READ,
] as const

/** Entity list endpoints used by attendance / absence views. */
const DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS = [
  Permission.QUERY_ATTENDANCE_READ,
  Permission.ATTENDANCE_READ,
] as const

/** Entity list endpoints used by discipline / incidents views. */
const DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS = [
  Permission.DISCIPLINE_READ,
] as const

/** Entity list endpoints used by report card / grade scale views. */
const DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS = [
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.GRADE_READ,
] as const

/** Entity list endpoints used by student drawer (health profiles, pedagogical notes). */
const DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS = [
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.STUDENT_HEALTH_READ,
] as const

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
] as const

function mergePermissions(...groups: readonly (readonly Permission[])[]): Permission[] {
  return [...new Set(groups.flat())]
}

export type DevAccessSeedResult
  = | { status: 'skipped', reason: 'school-not-seeded' }
    | { status: 'seeded', roles: number, assignments: number, staffAssignments: number }

export async function runDevAccessSeed(application: SeedApplication): Promise<DevAccessSeedResult> {
  const school = await application.repositories.schools.findById(SEED_SCHOOL_ID)
  if (!school) {
    return { status: 'skipped', reason: 'school-not-seeded' }
  }

  await application.repositories.accessRoles.save(new AccessRole({
    id: 'role-teacher',
    schoolId: SEED_SCHOOL_ID,
    name: 'Teacher',
    permissions: mergePermissions(
      TEACHER_PERMISSIONS,
      [Permission.GRADE_READ],
      DEV_WEBAPP_SHELL_READ_PERMISSIONS,
      DEV_WEBAPP_PEOPLE_READ_PERMISSIONS,
      DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS,
      DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS,
      DEV_WEBAPP_CALENDAR_READ_PERMISSIONS,
      DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS,
      DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS,
      DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS,
      DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS,
    ),
  }))

  await application.repositories.accessRoles.save(new AccessRole({
    id: 'role-coordinator',
    schoolId: SEED_SCHOOL_ID,
    name: 'Lead teacher',
    permissions: mergePermissions(
      COORDINATOR_PERMISSIONS,
      [Permission.SCHOOL_STRUCTURE_CONFIGURE, Permission.REPORT_CARD_CONFIGURE, Permission.REPORT_CARD_GENERATE, Permission.QUERY_STUDENT_DIRECTORY_READ],
      DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS,
      DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS,
      DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS,
      DEV_WEBAPP_CALENDAR_READ_PERMISSIONS,
      DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS,
      DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS,
      DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS,
      DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS,
    ),
  }))

  await application.repositories.accessRoles.save(new AccessRole({
    id: 'role-educator',
    schoolId: SEED_SCHOOL_ID,
    name: 'Educator',
    permissions: mergePermissions(
      EDUCATOR_PERMISSIONS,
      DEV_WEBAPP_SHELL_READ_PERMISSIONS,
      [Permission.QUERY_STUDENT_DIRECTORY_READ, Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ],
      DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS,
      DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS,
    ),
  }))

  await application.repositories.accessRoles.save(new AccessRole({
    id: 'role-director',
    schoolId: SEED_SCHOOL_ID,
    name: 'Director',
    permissions: mergePermissions(
      ELEVATED_STAFF_PERMISSIONS,
      DEV_WEBAPP_SHELL_READ_PERMISSIONS,
      DEV_WEBAPP_PEOPLE_READ_PERMISSIONS,
      DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS,
      DEV_WEBAPP_FINANCE_READ_PERMISSIONS,
      DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS,
      DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS,
      DEV_WEBAPP_CALENDAR_READ_PERMISSIONS,
      DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS,
      DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS,
      DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS,
      DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS,
    ),
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st1',
    staffId: 'st1',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-teacher'],
    scopeGrants: [],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st2',
    staffId: 'st2',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-teacher'],
    scopeGrants: [],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st3',
    staffId: 'st3',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-coordinator'],
    scopeGrants: [],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st4',
    staffId: 'st4',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-teacher'],
    scopeGrants: [],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st5',
    staffId: 'st5',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-director'],
    scopeGrants: [],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st6',
    staffId: 'st6',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-educator'],
    scopeGrants: [
      {
        permission: Permission.DISCIPLINE_CREATE,
        scopeType: 'school',
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
      {
        permission: Permission.ATTENDANCE_RECORD,
        scopeType: 'school',
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
    ],
    status: 'active',
  }))

  await application.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'sra-st7',
    staffId: 'st7',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: ['role-educator'],
    scopeGrants: [
      {
        permission: Permission.DISCIPLINE_CREATE,
        scopeType: 'school',
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
      {
        permission: Permission.ATTENDANCE_RECORD,
        scopeType: 'school',
        scopeEntityIds: [SEED_SCHOOL_ID],
      },
    ],
    status: 'active',
  }))

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: 'sa-st1-6a',
    staffId: 'st1',
    responsibility: 'Mathematics',
    classGroupId: '6a',
  }))

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: 'sa-st1-5a',
    staffId: 'st1',
    responsibility: 'Mathematics',
    classGroupId: '5a',
  }))

  await application.repositories.staffAssignments.save(new StaffAssignment({
    id: 'sa-st3-6a',
    staffId: 'st3',
    responsibility: 'Homeroom',
    classGroupId: '6a',
  }))

  for (const offering of SEED_CLASS_SUBJECTS) {
    await application.repositories.staffAssignments.save(new StaffAssignment({
      id: `sa-${offering.teacherId}-${offering.id}`,
      staffId: offering.teacherId,
      responsibility: 'Teacher',
      classSubjectId: offering.id,
    }))
  }

  return {
    status: 'seeded',
    roles: 4,
    assignments: 7,
    staffAssignments: 3 + SEED_CLASS_SUBJECTS.length,
  }
}
