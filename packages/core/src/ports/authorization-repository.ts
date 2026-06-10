import type { ScopeGrant } from '../authorization/model/scope-grant'
import type { Permission } from '../authorization/permissions/permission'
import type { ScopeType } from '../authorization/permissions/scope-type'
import type { StaffAssignment } from '../domains/school/staff-assignment'
import type { SchoolRepositories } from '../ports/school-repositories'
import { uniqueActiveClassGroupIds } from '../authorization/grants/enrollment-scope'
import { GUARDIAN_PORTAL_PERMISSIONS, STUDENT_PORTAL_PERMISSIONS } from '../authorization/grants/portal-permission-sets'
import { buildPortalScopeGrants } from '../authorization/grants/portal-scope-grants'
import { ASSIGNMENT_SCOPED_PERMISSION_SET, ASSIGNMENT_SCOPED_PERMISSIONS, ELEVATED_STAFF_PERMISSIONS } from '../authorization/grants/system-role-permissions'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization/model/errors'

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

  // A school-scoped grant for the permission covers any resource in that school
  const hasSchoolGrant = grants.some(grant =>
    grant.permission === args.permission
    && grant.scopeType === 'school'
    && (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)),
  )
  if (hasSchoolGrant) {
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
    return grant.scopeEntityIds.includes(args.scopeEntityId!)
  })
}

export async function resolveGuardianGrants(args: {
  guardianId: string
  schoolId: string
  repositories: SchoolRepositories
}): Promise<EffectiveGrants> {
  const guardian = await args.repositories.guardians.findById(args.guardianId)
  if (!guardian || guardian.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const links = await args.repositories.guardianLinks.list({ guardianId: args.guardianId })
  const studentIds = links.filter(l => l.schoolId === args.schoolId).map(l => l.studentId)
  const classGroupIds = await uniqueActiveClassGroupIds(args.repositories, studentIds)

  return {
    permissions: GUARDIAN_PORTAL_PERMISSIONS,
    scopeGrants: buildPortalScopeGrants(GUARDIAN_PORTAL_PERMISSIONS, { studentIds, classGroupIds }),
    isElevated: false,
  }
}

export async function resolveStudentGrants(args: {
  studentId: string
  schoolId: string
  repositories: SchoolRepositories
}): Promise<EffectiveGrants> {
  const student = await args.repositories.students.findById(args.studentId)
  if (!student || student.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const [activeClassGroupId] = await uniqueActiveClassGroupIds(args.repositories, [args.studentId])

  return {
    permissions: STUDENT_PORTAL_PERMISSIONS,
    scopeGrants: buildPortalScopeGrants(STUDENT_PORTAL_PERMISSIONS, {
      studentIds: [args.studentId],
      ...(activeClassGroupId ? { classGroupIds: [activeClassGroupId] } : {}),
    }),
    isElevated: false,
  }
}

export interface ResolveActorGrantsArgs {
  actorId: string
  actorType: 'staff' | 'guardian' | 'student'
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
}

export async function resolveActorGrants(args: ResolveActorGrantsArgs): Promise<EffectiveGrants> {
  switch (args.actorType) {
    case 'staff':
      return resolveEffectiveGrants({
        staffMemberId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
        academicYearId: args.academicYearId,
        now: args.now,
      })
    case 'guardian':
      return resolveGuardianGrants({
        guardianId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
    case 'student':
      return resolveStudentGrants({
        studentId: args.actorId,
        schoolId: args.schoolId,
        repositories: args.repositories,
      })
  }
}

export interface AuthorizationRepository {
  resolveEffectiveGrants: (args: {
    staffMemberId: string
    schoolId: string
    academicYearId?: string
    now?: Date
  }) => Promise<EffectiveGrants>
  resolveActorGrants: (args: {
    actorId: string
    actorType: 'staff' | 'guardian' | 'student'
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

  async resolveActorGrants(args: {
    actorId: string
    actorType: 'staff' | 'guardian' | 'student'
    schoolId: string
    academicYearId?: string
    now?: Date
  }): Promise<EffectiveGrants> {
    return resolveActorGrants({
      ...args,
      repositories: this.repositories as SchoolRepositories,
    })
  }
}
