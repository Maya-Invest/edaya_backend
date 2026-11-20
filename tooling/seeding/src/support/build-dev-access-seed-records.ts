import type { GrantScope } from '@edaya/core'
import type { DevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import type {
  AccessRolePresetRecord,
  StaffAssignmentSeedRecord,
  StaffRoleAssignmentPresetRecord,
} from '../domains/access/port'
import { COORDINATOR_PERMISSIONS, Permission, SCHOOL_OWNER_ACTIONS } from '@edaya/authorization'
import { corePermissionDefinition } from '@edaya/core'

const SCHOOL_LEADERSHIP_ROLE_IDS = new Set(['role-director', 'role-coordinator'])

function buildSchoolLeadershipScopes(context: DevSeedContext): StaffRoleAssignmentPresetRecord['scopesByPermission'] {
  const classGroupIds = context.dataset.entities.classGroups?.map(classGroup => classGroup.id) ?? []

  return Object.fromEntries(Object.values(Permission).flatMap((permission) => {
    const definition = corePermissionDefinition(permission)
    const policy = definition.scopePolicy
    if (!definition.staffAssignable || policy.mode !== 'resources' || !policy.allowedKinds.includes('class_group'))
      return []
    const scopes: GrantScope[] = classGroupIds.map(classGroupId => ({ kind: 'class_group', classGroupId }))
    return [[permission, scopes]]
  }))
}

function scopesByPermissionForRole(context: DevSeedContext, roleId: string): StaffRoleAssignmentPresetRecord['scopesByPermission'] {
  if (SCHOOL_LEADERSHIP_ROLE_IDS.has(roleId)) {
    return buildSchoolLeadershipScopes(context)
  }
  return {}
}

const DEV_WEBAPP_SHELL_READ_PERMISSIONS = [
  Permission.CLASS_READ,
  Permission.ENROLLMENT_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.OVERDUE_BALANCE_READ,
] as const

const DEV_WEBAPP_PEOPLE_READ_PERMISSIONS = [
  Permission.STUDENT_READ,
  Permission.PARENT_READ,
] as const

const DEV_WEBAPP_STAFF_ADMIN_READ_PERMISSIONS = [
  Permission.SCHOOL_CONFIGURE,
  Permission.ACCESS_CONTROL_READ,
  Permission.STAFF_READ,
] as const

const DEV_WEBAPP_FINANCE_READ_PERMISSIONS = [
  Permission.FINANCIAL_CONFIG_READ,
  Permission.PAYMENT_READ,
] as const

const DEV_WEBAPP_SCHEDULING_READ_PERMISSIONS = [
  Permission.TIMETABLE_READ,
  Permission.RESOURCE_READ,
] as const

const DEV_WEBAPP_ASSESSMENT_READ_PERMISSIONS = [
  Permission.GRADE_READ,
] as const

const DEV_WEBAPP_CALENDAR_READ_PERMISSIONS = [
  Permission.TIMETABLE_READ,
] as const

const DEV_WEBAPP_ATTENDANCE_READ_PERMISSIONS = [
  Permission.ATTENDANCE_READ,
] as const

const DEV_WEBAPP_DISCIPLINE_READ_PERMISSIONS = [
  Permission.DISCIPLINE_READ,
] as const

const DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS = [
  Permission.REPORT_CARD_READ,
  Permission.GRADE_READ,
] as const

const DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS = [
  Permission.STUDENT_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.STUDENT_HEALTH_READ,
] as const

const EDUCATOR_PERMISSIONS = [
  Permission.DISCIPLINE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.DISCIPLINE_MANAGE,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_MANAGE,
  Permission.CLASS_LOGBOOK_READ,
  Permission.GRADE_READ,
  Permission.STUDENT_READ,
] as const

function mergePermissions(...groups: readonly (readonly Permission[])[]): Permission[] {
  return [...new Set(groups.flat())].filter(permission => corePermissionDefinition(permission).staffAssignable)
}

function buildAccessRoleRecords(schoolId: string): readonly AccessRolePresetRecord[] {
  return [
    {
      id: 'role-coordinator',
      schoolId,
      name: 'Lead teacher',
      permissions: mergePermissions(
        COORDINATOR_PERMISSIONS,
        [Permission.SCHOOL_CONFIGURE, Permission.REPORT_CARD_CONFIGURE, Permission.REPORT_CARD_GENERATE, Permission.STUDENT_READ, Permission.WORKSPACE_ACCESS],
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
        [Permission.STUDENT_READ, Permission.PARENT_READ],
        DEV_WEBAPP_STUDENT_360_READ_PERMISSIONS,
        DEV_WEBAPP_REPORT_CARD_READ_PERMISSIONS,
      ),
    },
    {
      id: 'role-director',
      schoolId,
      name: 'Director',
      permissions: mergePermissions(
        SCHOOL_OWNER_ACTIONS,
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
  scopesByPermission: StaffRoleAssignmentPresetRecord['scopesByPermission'] = {},
): StaffRoleAssignmentPresetRecord {
  const academicYearId = context.dataset.entities.academicYear?.id
    ?? (() => { throw new Error('Seed dataset must include academicYear for access seeding') })()

  return {
    staffId,
    schoolId: context.schoolId,
    academicYearId,
    roleId,
    scopesByPermission,
    status: 'active',
  }
}

function buildStaffRoleAssignmentRecords(context: DevSeedContext): readonly StaffRoleAssignmentPresetRecord[] {
  const schoolDisciplineAndAttendanceGrants: StaffRoleAssignmentPresetRecord['scopesByPermission'] = {
    [Permission.DISCIPLINE_CREATE]: [{ kind: 'all', grain: 'class_group' }],
    [Permission.ATTENDANCE_RECORD]: [{ kind: 'all', grain: 'class_group' }],
  }

  const roles = context.staffAccessRoleIds
  return [
    createStaffRoleAssignment(context, 'ci-st3', roles['ci-st3']!, scopesByPermissionForRole(context, roles['ci-st3']!)),
    createStaffRoleAssignment(context, 'ci-st8', roles['ci-st8']!, scopesByPermissionForRole(context, roles['ci-st8']!)),
    createStaffRoleAssignment(context, 'ci-st5', roles['ci-st5']!, scopesByPermissionForRole(context, roles['ci-st5']!)),
    createStaffRoleAssignment(context, 'ci-st7', roles['ci-st7']!, schoolDisciplineAndAttendanceGrants),
  ]
}

function buildBaseStaffAssignmentRecords(context: DevSeedContext): readonly StaffAssignmentSeedRecord[] {
  const academicYearId = context.dataset.entities.academicYear?.id
    ?? (() => { throw new Error('Seed dataset must include academicYear for access seeding') })()

  return [
    { id: 'sa-ci-st3-6a', staffId: 'ci-st3', academicYearId, responsibility: 'Professeur principal', classGroupId: 'ci-6a' },
    { id: 'sa-ci-st3-5a', staffId: 'ci-st3', academicYearId, responsibility: 'Professeur principal', classGroupId: 'ci-5a' },
  ]
}

export function buildDevAccessSeedRecords(context: DevSeedContext) {
  return {
    accessRoleRecords: buildAccessRoleRecords(context.schoolId),
    staffRoleAssignmentRecords: buildStaffRoleAssignmentRecords(context),
    baseStaffAssignmentRecords: buildBaseStaffAssignmentRecords(context),
  }
}
