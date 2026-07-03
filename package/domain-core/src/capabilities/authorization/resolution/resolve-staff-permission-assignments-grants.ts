import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { ELEVATED_STAFF_PERMISSIONS } from '../grants/system-role-permissions'
import { effectiveGrantsFromStaffPermissionAssignments } from './resolve-staff-permission-assignments'

export interface ResolveStaffPermissionAssignmentGrantsArgs {
  staffMemberId: string
  schoolId: string
  academicYearId: string
  repositories: SchoolRepositories
  now?: Date
}

export async function resolveStaffGrantsFromPermissionAssignments(
  args: ResolveStaffPermissionAssignmentGrantsArgs,
): Promise<EffectiveGrants | undefined> {
  if (!hasStaffPermissionAssignmentRepository(args.repositories)) {
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

  const assignments = await args.repositories.staffPermissionAssignments.list({
    staffId: args.staffMemberId,
    schoolId: args.schoolId,
    academicYearId: args.academicYearId,
    status: 'active',
  })

  if (assignments.length === 0) {
    return undefined
  }

  const now = args.now ?? new Date()
  const activeInWindow = assignments.filter(assignment =>
    (!assignment.startsAt || assignment.startsAt <= now)
    && (!assignment.endsAt || assignment.endsAt > now))

  if (activeInWindow.length === 0) {
    return undefined
  }

  return effectiveGrantsFromStaffPermissionAssignments(activeInWindow, {
    expiresAt: nextExpiry(activeInWindow),
  })
}

function nextExpiry(assignments: readonly { endsAt?: Date }[]): Date | undefined {
  const expiries = assignments
    .map(assignment => assignment.endsAt)
    .filter((endsAt): endsAt is Date => endsAt !== undefined)
    .sort((a, b) => a.getTime() - b.getTime())

  return expiries[0]
}

function hasStaffPermissionAssignmentRepository(
  repositories: SchoolRepositories,
): repositories is SchoolRepositories & {
  staffPermissionAssignments: SchoolRepositories['staffPermissionAssignments']
} {
  return 'staffPermissionAssignments' in repositories
    && repositories.staffPermissionAssignments !== undefined
}
