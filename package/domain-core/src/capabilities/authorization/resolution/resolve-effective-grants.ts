import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import { mergeScopeGrants } from '../grants/scope-grant-covers'
import { scopeGrantsFromStaffAssignments } from '../grants/staff-assignment-scope'
import { ASSIGNMENT_SCOPED_PERMISSION_SET, ELEVATED_STAFF_PERMISSIONS } from '../grants/system-role-permissions'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export interface ResolveEffectiveGrantsArgs {
  staffMemberId: string
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
}

export async function resolveEffectiveGrants(
  args: ResolveEffectiveGrantsArgs,
): Promise<EffectiveGrants> {
  const persisted = await tryResolveEffectiveGrantsFromPersistence(args)
  if (persisted) {
    return persisted
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function tryResolveEffectiveGrantsFromPersistence(
  args: ResolveEffectiveGrantsArgs,
): Promise<EffectiveGrants | undefined> {
  if (!hasAccessControlRepositories(args.repositories)) {
    return undefined
  }

  const staffMember = await args.repositories.staffMembers.findById(args.staffMemberId)
  if (!staffMember || !staffMember.isActive || staffMember.schoolId !== args.schoolId) {
    return undefined
  }

  if (staffMember.accountKind === 'service' && staffMember.serviceElevated) {
    return {
      permissions: new Set(ELEVATED_STAFF_PERMISSIONS),
      scopeGrants: [],
      isElevated: true,
    }
  }

  const school = await args.repositories.schools?.findById?.(args.schoolId)
  if (school?.ownerSubjectId && staffMember.subjectId === school.ownerSubjectId) {
    return {
      permissions: new Set(ELEVATED_STAFF_PERMISSIONS),
      scopeGrants: [],
      isElevated: true,
    }
  }

  const assignments = await args.repositories.staffRoleAssignments.list({
    staffId: args.staffMemberId,
    schoolId: args.schoolId,
    status: 'active',
  })

  if (assignments.length === 0) {
    return undefined
  }

  const now = args.now ?? new Date()
  const activeInWindow = assignments.filter(assignment =>
    (!assignment.startsAt || assignment.startsAt <= now)
    && (!assignment.endsAt || assignment.endsAt > now))

  const scoped = args.academicYearId
    ? activeInWindow.filter(assignment => !assignment.academicYearId || assignment.academicYearId === args.academicYearId)
    : activeInWindow

  if (scoped.length === 0) {
    return undefined
  }

  const roleIds = [...new Set(scoped.flatMap(assignment => [...assignment.roleIds]))]
  const roles = await args.repositories.accessRoles.findByIds(roleIds)
  const activeRoles = roles.filter(role => role.status === 'active')

  const permissions = new Set<Permission>()
  for (const role of activeRoles) {
    for (const permission of role.permissions) {
      permissions.add(permission)
    }
  }

  const autoSchoolGrants: ScopeGrant[] = []
  for (const permission of permissions) {
    if (!ASSIGNMENT_SCOPED_PERMISSION_SET.has(permission)) {
      autoSchoolGrants.push({
        permission,
        scopeType: 'school',
        scopeEntityIds: [args.schoolId],
      })
    }
  }

  const assignmentScopeGrants = scopeGrantsFromStaffAssignments(
    await args.repositories.staffAssignments.list({ staffId: args.staffMemberId }),
  )
  const scopeGrants = mergeScopeGrants([
    ...scoped.flatMap(assignment => [...assignment.scopeGrants]),
    ...assignmentScopeGrants,
    ...autoSchoolGrants,
  ])

  return {
    permissions,
    scopeGrants,
    isElevated: false,
    ...nextExpiry(scoped),
  }
}

function nextExpiry(assignments: readonly { endsAt?: Date }[]): { expiresAt?: Date } {
  const expiries = assignments
    .map(assignment => assignment.endsAt)
    .filter((endsAt): endsAt is Date => endsAt !== undefined)
    .sort((a, b) => a.getTime() - b.getTime())

  return expiries[0] ? { expiresAt: expiries[0] } : {}
}

function hasAccessControlRepositories(
  repositories: SchoolRepositories,
): repositories is SchoolRepositories & {
  accessRoles: SchoolRepositories['accessRoles']
  staffRoleAssignments: SchoolRepositories['staffRoleAssignments']
} {
  return 'accessRoles' in repositories
    && 'staffRoleAssignments' in repositories
    && repositories.accessRoles !== undefined
    && repositories.staffRoleAssignments !== undefined
}
