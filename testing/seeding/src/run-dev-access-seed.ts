import type {
  AccessRoleSeedRecord,
  AccessSeedPort,
  StaffAssignmentSeedRecord,
  StaffRoleAssignmentSeedRecord,
} from './access/port'
import type { AuthLinkSeedPort } from './auth-link/port'
import type { AuthProvisioner, SeedApplication } from './types'
import {
  COORDINATOR_PERMISSIONS,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  TEACHER_PERMISSIONS,
} from '@edaya/core'
import {
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASS_SUBJECTS,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { createInProcessAccessSeedPort } from './access/in-process'
import { createInProcessAuthLinkSeedPort } from './auth-link/in-process'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'
import { SeedPortError } from './seed-port-error'

/** Entity list endpoints used by the webapp shell loaders. */
const DEV_WEBAPP_SHELL_READ_PERMISSIONS = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.QUERY_OVERDUE_FEES_READ,
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

const ACCESS_ROLE_RECORDS: readonly AccessRoleSeedRecord[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
]

const SCHOOL_DISCIPLINE_AND_ATTENDANCE_GRANTS = [
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
] as const

function createStaffRoleAssignment(
  staffId: string,
  roleId: string,
  scopeGrants: StaffRoleAssignmentSeedRecord['scopeGrants'] = [],
): StaffRoleAssignmentSeedRecord {
  return {
    id: `sra-${staffId}`,
    staffId,
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    roleIds: [roleId],
    scopeGrants,
    status: 'active',
  }
}

const STAFF_ROLE_ASSIGNMENT_RECORDS: readonly StaffRoleAssignmentSeedRecord[] = [
  createStaffRoleAssignment('st1', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st1),
  createStaffRoleAssignment('st2', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st2),
  createStaffRoleAssignment('st3', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st3),
  createStaffRoleAssignment('st4', 'role-teacher'),
  createStaffRoleAssignment('st8', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st8),
  createStaffRoleAssignment('st5', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5),
  createStaffRoleAssignment('st6', 'role-educator', SCHOOL_DISCIPLINE_AND_ATTENDANCE_GRANTS),
  createStaffRoleAssignment('st7', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st7, SCHOOL_DISCIPLINE_AND_ATTENDANCE_GRANTS),
]

const BASE_STAFF_ASSIGNMENT_RECORDS: readonly StaffAssignmentSeedRecord[] = [
  { id: 'sa-st1-6a', staffId: 'st1', responsibility: 'Mathematics', classGroupId: '6a' },
  { id: 'sa-st1-5a', staffId: 'st1', responsibility: 'Mathematics', classGroupId: '5a' },
  { id: 'sa-st3-6a', staffId: 'st3', responsibility: 'Homeroom', classGroupId: '6a' },
  { id: 'sa-st2-6b', staffId: 'st2', responsibility: 'Homeroom', classGroupId: '6b' },
  { id: 'sa-st3-5a', staffId: 'st3', responsibility: 'Homeroom', classGroupId: '5a' },
]

export type DevAccessSeedResult
  = | { status: 'skipped', reason: 'school-not-seeded' }
    | { status: 'seeded', roles: number, assignments: number, staffAssignments: number }

export interface RunDevAccessSeedOptions {
  auth?: AuthProvisioner
  ownerSubjectId?: string
  authLinkPort?: AuthLinkSeedPort
}

/** Access roles only — used before service-account provisioning in HTTP bootstrap. */
export async function runDevAccessRolesSeedWithPort(port: AccessSeedPort): Promise<void> {
  if (!(await port.schoolExists(SEED_SCHOOL_ID))) {
    throw new Error('Cannot seed access roles before school exists')
  }

  for (const role of ACCESS_ROLE_RECORDS) {
    await port.saveAccessRole(role)
  }
}

/** Staff role + class assignments — run after school structure exists. */
export async function runDevAccessAssignmentsSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  if (!(await port.schoolExists(SEED_SCHOOL_ID))) {
    return { status: 'skipped', reason: 'school-not-seeded' }
  }

  if (options?.auth) {
    if (!options.authLinkPort) {
      throw new SeedPortError('access.authLink', { detail: 'authLinkPort is required when auth is provided' })
    }
    await syncDevStaffAuthAndOwner(
      options.authLinkPort,
      options.auth,
      options.ownerSubjectId,
    )
  }

  for (const assignment of STAFF_ROLE_ASSIGNMENT_RECORDS) {
    await port.saveStaffRoleAssignment(assignment)
  }

  for (const assignment of BASE_STAFF_ASSIGNMENT_RECORDS) {
    await port.saveStaffAssignment(assignment)
  }

  for (const offering of SEED_CLASS_SUBJECTS) {
    await port.saveStaffAssignment({
      id: `sa-${offering.teacherId}-${offering.id}`,
      staffId: offering.teacherId,
      responsibility: 'Teacher',
      classSubjectId: offering.id,
    })
  }

  return {
    status: 'seeded',
    roles: ACCESS_ROLE_RECORDS.length,
    assignments: STAFF_ROLE_ASSIGNMENT_RECORDS.length,
    staffAssignments: BASE_STAFF_ASSIGNMENT_RECORDS.length + SEED_CLASS_SUBJECTS.length,
  }
}

export function runDevAccessRolesSeed(application: SeedApplication): Promise<void> {
  return runDevAccessRolesSeedWithPort(createInProcessAccessSeedPort(application))
}

export function runDevAccessAssignmentsSeed(
  application: SeedApplication,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  return runDevAccessAssignmentsSeedWithPort(
    createInProcessAccessSeedPort(application),
    options?.auth
      ? {
          ...options,
          authLinkPort: options.authLinkPort ?? createInProcessAuthLinkSeedPort(application),
        }
      : options,
  )
}

export async function runDevAccessSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  await runDevAccessRolesSeedWithPort(port)
  return runDevAccessAssignmentsSeedWithPort(port, options)
}

export async function runDevAccessSeed(
  application: SeedApplication,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  const port = createInProcessAccessSeedPort(application)
  return runDevAccessSeedWithPort(
    port,
    options?.auth
      ? {
          ...options,
          authLinkPort: options.authLinkPort ?? createInProcessAuthLinkSeedPort(application),
        }
      : options,
  )
}
