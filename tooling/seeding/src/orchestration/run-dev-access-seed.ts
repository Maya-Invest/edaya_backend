import type {
  AccessRolePresetRecord,
  AccessSeedPort,
  StaffAssignmentSeedRecord,
  StaffRoleAssignmentPresetRecord,
} from '../domains/access/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import {
  ASSIGNMENT_SCOPED_PERMISSIONS,
  COORDINATOR_PERMISSIONS,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  permissionRowsFromTemplatePermissions,
  TEACHER_PERMISSIONS,
} from '@edaya/core'
import { demoDataset, devSeedDataset } from '@edaya/fixtures'
import {
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessAccessSeedPort } from '../domains/access/in-process'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/in-process'
import { SeedPortError } from '../support/seed-port-error'

const accessSeedAcademicYearId = devSeedDataset.entities.academicYear?.id
  ?? (() => { throw new Error('devSeedDataset must include academicYear for access seeding') })()

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

const ACCESS_ROLE_PRESETS: readonly AccessRolePresetRecord[] = [
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
      [Permission.SCHOOL_STRUCTURE_CONFIGURE, Permission.REPORT_CARD_CONFIGURE, Permission.REPORT_CARD_GENERATE, Permission.QUERY_STUDENT_DIRECTORY_READ, Permission.QUERY_OVERVIEW_READ],
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

function createStaffRolePreset(
  staffId: string,
  roleId: string,
  scopeGrants: StaffRoleAssignmentPresetRecord['scopeGrants'] = [],
): StaffRoleAssignmentPresetRecord {
  return {
    staffId,
    schoolId: SEED_SCHOOL_ID,
    academicYearId: accessSeedAcademicYearId,
    roleId,
    scopeGrants,
    status: 'active',
  }
}

const STAFF_ROLE_ASSIGNMENT_PRESETS: readonly StaffRoleAssignmentPresetRecord[] = [
  createStaffRolePreset('st1', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st1),
  createStaffRolePreset('st2', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st2),
  createStaffRolePreset('st3', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st3),
  createStaffRolePreset('st4', 'role-teacher'),
  createStaffRolePreset('st8', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st8),
  createStaffRolePreset('st5', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5),
  createStaffRolePreset('st6', 'role-educator', SCHOOL_DISCIPLINE_AND_ATTENDANCE_GRANTS),
  createStaffRolePreset('st7', DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st7, SCHOOL_DISCIPLINE_AND_ATTENDANCE_GRANTS),
]

async function seedStaffPermissionAssignments(port: AccessSeedPort): Promise<number> {
  const presetsById = new Map(ACCESS_ROLE_PRESETS.map(role => [role.id, role]))
  let count = 0

  for (const assignment of STAFF_ROLE_ASSIGNMENT_PRESETS) {
    const role = presetsById.get(assignment.roleId)
    if (!role) {
      continue
    }

    const rows = permissionRowsFromTemplatePermissions(
      assignment.staffId,
      assignment.schoolId,
      assignment.academicYearId,
      role.permissions,
      assignment.scopeGrants ?? [],
    )

    for (const [index, row] of rows.entries()) {
      await port.saveStaffPermissionAssignment({
        id: `spa-${assignment.staffId}-${row.permission}-${index}`,
        ...row,
        status: 'active',
      })
      count += 1
    }
  }

  return count
}

const BASE_STAFF_ASSIGNMENT_RECORDS: readonly StaffAssignmentSeedRecord[] = [
  { id: 'sa-st1-6a', staffId: 'st1', academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, responsibility: 'Mathematics', classGroupId: '6a' },
  { id: 'sa-st1-5a', staffId: 'st1', academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, responsibility: 'Mathematics', classGroupId: '5a' },
  { id: 'sa-st3-6a', staffId: 'st3', academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, responsibility: 'Homeroom', classGroupId: '6a' },
  { id: 'sa-st2-6b', staffId: 'st2', academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, responsibility: 'Homeroom', classGroupId: '6b' },
  { id: 'sa-st3-5a', staffId: 'st3', academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, responsibility: 'Homeroom', classGroupId: '5a' },
]

export type DevAccessSeedResult
  = | { status: 'skipped', reason: 'school-not-seeded' }
    | { status: 'seeded', permissionAssignments: number, staffAssignments: number }

export interface RunDevAccessSeedOptions {
  auth?: AuthProvisioner
  ownerSubjectId?: string
  authLinkPort?: AuthLinkSeedPort
  /** When set, staff/class assignments use this port instead of the roles port. */
  assignmentsPort?: AccessSeedPort
  /** Runs immediately before staff/class assignment writes (e.g. refresh owner session). */
  beforeAssignments?: () => Promise<void>
  /** When false, skip class-subject teacher assignments (integration light fixture). */
  includeClassSubjectStaffAssignments?: boolean
}

/** @deprecated Access roles are code presets; permission rows are seeded directly. */
export async function runDevAccessRolesSeedWithPort(_port: AccessSeedPort): Promise<void> {
}

/** Staff permission + class assignments — run after school structure exists. */
export async function runDevAccessAssignmentsSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  if (options?.beforeAssignments) {
    await options.beforeAssignments()
  }

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

  const permissionAssignments = await seedStaffPermissionAssignments(port)

  for (const assignment of BASE_STAFF_ASSIGNMENT_RECORDS) {
    await port.saveStaffAssignment({
      ...assignment,
      permissions: assignment.permissions ?? [...ASSIGNMENT_SCOPED_PERMISSIONS],
    })
  }

  let classSubjectStaffAssignments = 0
  if (options?.includeClassSubjectStaffAssignments !== false) {
    for (const assignment of demoDataset.extensions?.classSubjectStaffAssignments ?? []) {
      await port.saveStaffAssignment(assignment)
      classSubjectStaffAssignments += 1
    }
  }

  return {
    status: 'seeded',
    permissionAssignments,
    staffAssignments: BASE_STAFF_ASSIGNMENT_RECORDS.length + classSubjectStaffAssignments,
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
  return runDevAccessAssignmentsSeedWithPort(options?.assignmentsPort ?? port, options)
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
