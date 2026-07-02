import type {
  AccessRoleSeedRecord,
  StaffAssignmentSeedRecord,
  StaffRoleAssignmentSeedRecord,
} from '../domains/access/port'
import type { DevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import {
  COORDINATOR_PERMISSIONS,
  ELEVATED_STAFF_PERMISSIONS,
  Permission,
  TEACHER_PERMISSIONS,
} from '@edaya/core'

const DEV_WEBAPP_SHELL_READ_PERMISSIONS = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.QUERY_OVERDUE_FEES_READ,
] as const

const DEV_WEBAPP_PEOPLE_READ_PERMISSIONS = [
  Permission.QUERY_STUDENT_DIRECTORY_READ,
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.STUDENT_READ,
  Permission.PARENT_READ,
] as const

const DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS = [
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
  Permission.ACCESS_CONTROL_READ,
  Permission.STAFF_READ,
] as const

const DEV_WEBAPP_FINANCE_READ_PERMISSIONS = [
  Permission.FINANCIAL_CONFIG_READ,
  Permission.PAYMENT_READ,
] as const

const DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS = [
  Permission.QUERY_TIMETABLE_READ,
  Permission.RESOURCE_READ,
] as const

const DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS = [
  Permission.GRADE_READ,
] as const

const DEV_WEBAPP_CALENDAR_READ_PERMISSIONS = [
  Permission.QUERY_CALENDAR_READ,
] as const

const DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS = [
  Permission.QUERY_ATTENDANCE_READ,
  Permission.ATTENDANCE_READ,
] as const

const DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS = [
  Permission.DISCIPLINE_READ,
] as const

const DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS = [
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.GRADE_READ,
] as const

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

function buildAccessRoleRecords(schoolId: string): readonly AccessRoleSeedRecord[] {
  return [
    {
      id: 'role-teacher',
      schoolId,
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
      schoolId,
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
      schoolId,
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
      schoolId,
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
}

function createStaffRoleAssignment(
  context: DevSeedContext,
  staffId: string,
  roleId: string,
  scopeGrants: StaffRoleAssignmentSeedRecord['scopeGrants'] = [],
): StaffRoleAssignmentSeedRecord {
  const academicYearId = context.dataset.entities.academicYear?.id
    ?? (() => { throw new Error('Seed dataset must include academicYear for access seeding') })()

  return {
    id: `sra-${staffId}`,
    staffId,
    schoolId: context.schoolId,
    academicYearId,
    roleIds: [roleId],
    scopeGrants,
    status: 'active',
  }
}

function buildStaffRoleAssignmentRecords(context: DevSeedContext): readonly StaffRoleAssignmentSeedRecord[] {
  const schoolDisciplineAndAttendanceGrants = [
    {
      permission: Permission.DISCIPLINE_CREATE,
      scopeType: 'school' as const,
      scopeEntityIds: [context.schoolId],
    },
    {
      permission: Permission.ATTENDANCE_RECORD,
      scopeType: 'school' as const,
      scopeEntityIds: [context.schoolId],
    },
  ]

  if (context.datasetId === 'ci') {
    const roles = context.staffAccessRoleIds
    return [
      createStaffRoleAssignment(context, 'ci-st1', roles['ci-st1']!),
      createStaffRoleAssignment(context, 'ci-st2', roles['ci-st2']!),
      createStaffRoleAssignment(context, 'ci-st3', roles['ci-st3']!),
      createStaffRoleAssignment(context, 'ci-st8', roles['ci-st8']!),
      createStaffRoleAssignment(context, 'ci-st5', roles['ci-st5']!),
      createStaffRoleAssignment(context, 'ci-st7', roles['ci-st7']!, schoolDisciplineAndAttendanceGrants),
    ]
  }

  const roles = context.staffAccessRoleIds
  return [
    createStaffRoleAssignment(context, 'st1', roles['st1']!),
    createStaffRoleAssignment(context, 'st2', roles['st2']!),
    createStaffRoleAssignment(context, 'st3', roles['st3']!),
    createStaffRoleAssignment(context, 'st4', 'role-teacher'),
    createStaffRoleAssignment(context, 'st8', roles['st8']!),
    createStaffRoleAssignment(context, 'st5', roles['st5']!),
    createStaffRoleAssignment(context, 'st6', 'role-educator', schoolDisciplineAndAttendanceGrants),
    createStaffRoleAssignment(context, 'st7', roles['st7']!, schoolDisciplineAndAttendanceGrants),
  ]
}

function buildBaseStaffAssignmentRecords(context: DevSeedContext): readonly StaffAssignmentSeedRecord[] {
  if (context.datasetId === 'ci') {
    return [
      { id: 'sa-ci-st1-6a', staffId: 'ci-st1', responsibility: 'Mathématiques', classGroupId: 'ci-6a' },
      { id: 'sa-ci-st1-5a', staffId: 'ci-st1', responsibility: 'Mathématiques', classGroupId: 'ci-5a' },
      { id: 'sa-ci-st3-6a', staffId: 'ci-st3', responsibility: 'Professeur principal', classGroupId: 'ci-6a' },
      { id: 'sa-ci-st2-6b', staffId: 'ci-st2', responsibility: 'Professeur principal', classGroupId: 'ci-6b' },
      { id: 'sa-ci-st3-5a', staffId: 'ci-st3', responsibility: 'Professeur principal', classGroupId: 'ci-5a' },
    ]
  }

  return [
    { id: 'sa-st1-6a', staffId: 'st1', responsibility: 'Mathematics', classGroupId: '6a' },
    { id: 'sa-st1-5a', staffId: 'st1', responsibility: 'Mathematics', classGroupId: '5a' },
    { id: 'sa-st3-6a', staffId: 'st3', responsibility: 'Homeroom', classGroupId: '6a' },
    { id: 'sa-st2-6b', staffId: 'st2', responsibility: 'Homeroom', classGroupId: '6b' },
    { id: 'sa-st3-5a', staffId: 'st3', responsibility: 'Homeroom', classGroupId: '5a' },
  ]
}

export function buildDevAccessSeedRecords(context: DevSeedContext) {
  return {
    accessRoleRecords: buildAccessRoleRecords(context.schoolId),
    staffRoleAssignmentRecords: buildStaffRoleAssignmentRecords(context),
    baseStaffAssignmentRecords: buildBaseStaffAssignmentRecords(context),
  }
}
