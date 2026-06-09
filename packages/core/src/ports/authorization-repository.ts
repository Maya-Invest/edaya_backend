import type { Permission } from '../authorization/permissions/permission'
import type { ScopeType } from '../authorization/permissions/scope-type'
import type { ScopeGrant } from '../authorization/role-types'
import type { StaffAssignment } from '../domains'
import type { SchoolRepositories } from '../ports/school-repositories'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization/authorization-error'
import { ASSIGNMENT_SCOPED_PERMISSIONS, ELEVATED_STAFF_PERMISSIONS, ELEVATED_STAFF_ROLES } from '../authorization/system-role-permissions'

export interface EffectiveGrants {
  readonly permissions: ReadonlySet<Permission>
  readonly scopeGrants: readonly ScopeGrant[]
  /** Admin / Principal: school-wide access without per-entity scope grants. */
  readonly isElevated: boolean
  /** Earliest grant expiry represented in this grant set, used to bound caches. */
  readonly expiresAt?: Date
}

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

  const school = await args.repositories.schools?.findById?.(args.schoolId)
  if (school?.ownerStaffId === args.staffMemberId) {
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

  const isElevated = activeRoles.some(role =>
    role.systemRoleKey !== undefined && ELEVATED_STAFF_ROLES.has(role.systemRoleKey))
  const assignmentScopeGrants = isElevated
    ? []
    : scopeGrantsFromStaffAssignments(await args.repositories.staffAssignments.list({ staffId: args.staffMemberId }))
  const scopeGrants = mergeScopeGrants([
    ...scoped.flatMap(assignment => [...assignment.scopeGrants]),
    ...assignmentScopeGrants,
  ])

  return {
    permissions,
    scopeGrants,
    isElevated,
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

export function scopeGrantsFromStaffAssignments(
  assignments: readonly StaffAssignment[],
): ScopeGrant[] {
  const grants: ScopeGrant[] = []

  for (const assignment of assignments) {
    grants.push(...scopeGrantsFromStaffAssignment(assignment))
  }

  return grants
}

function scopeGrantsFromStaffAssignment(assignment: StaffAssignment): ScopeGrant[] {
  const grants: ScopeGrant[] = []

  if (assignment.classGroupId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'class_group',
        scopeEntityIds: [assignment.classGroupId],
      })
    }
  }

  if (assignment.classSubjectId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'course_assignment',
        scopeEntityIds: [assignment.classSubjectId],
      })
    }
  }

  if (assignment.sessionId) {
    for (const permission of ASSIGNMENT_SCOPED_PERMISSIONS) {
      grants.push({
        permission,
        scopeType: 'session',
        scopeEntityIds: [assignment.sessionId],
      })
    }
  }

  return grants
}

export function mergeScopeGrants(grants: readonly ScopeGrant[]): ScopeGrant[] {
  const merged = new Map<string, ScopeGrant>()

  for (const grant of grants) {
    const key = `${grant.permission}:${grant.scopeType}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        permission: grant.permission,
        scopeType: grant.scopeType,
        scopeEntityIds: [...grant.scopeEntityIds],
      })
      continue
    }

    merged.set(key, {
      ...existing,
      scopeEntityIds: [...new Set([...existing.scopeEntityIds, ...grant.scopeEntityIds])],
    })
  }

  return [...merged.values()]
}

export function scopeGrantCovers(
  grants: readonly ScopeGrant[],
  args: {
    permission: Permission
    schoolId: string
    scopeType?: ScopeType
    scopeEntityId?: string
    isElevated: boolean
  },
): boolean {
  if (args.isElevated) {
    return true
  }

  if (!args.scopeType) {
    return true
  }

  const matching = grants.filter(grant =>
    grant.permission === args.permission && grant.scopeType === args.scopeType)

  if (matching.length === 0) {
    return false
  }

  if (!args.scopeEntityId) {
    return true
  }

  return matching.some((grant) => {
    if (grant.scopeType === 'school') {
      return grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)
    }
    return grant.scopeEntityIds.includes(args.scopeEntityId!)
  })
}

export interface AuthorizationRepository {
  resolveEffectiveGrants: (args: {
    staffMemberId: string
    schoolId: string
    academicYearId?: string
    now?: Date
  }) => Promise<EffectiveGrants>
}

export class DefaultAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly repositories: Omit<SchoolRepositories, 'authorization'>) {}

  async resolveEffectiveGrants(args: {
    staffMemberId: string
    schoolId: string
    academicYearId?: string
    now?: Date
  }): Promise<EffectiveGrants> {
    return resolveEffectiveGrants({
      ...args,
      repositories: this.repositories as SchoolRepositories,
    })
  }
}
