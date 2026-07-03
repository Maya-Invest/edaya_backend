import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { ELEVATED_STAFF_PERMISSIONS } from '../grants/system-role-permissions'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { resolveStaffGrantsFromPermissionAssignments } from './resolve-staff-permission-assignments-grants'

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

  const academicYearId = args.academicYearId ?? await resolveDefaultStaffAcademicYearId(args)
  if (!academicYearId) {
    return undefined
  }

  return resolveStaffGrantsFromPermissionAssignments({
    staffMemberId: args.staffMemberId,
    schoolId: args.schoolId,
    academicYearId,
    repositories: args.repositories,
    now: args.now,
  })
}

async function resolveDefaultStaffAcademicYearId(
  args: ResolveEffectiveGrantsArgs,
): Promise<string | undefined> {
  const list = args.repositories.academicYears?.list
  if (!list) {
    return undefined
  }

  const years = await list({ schoolId: args.schoolId })
  if (years.length === 0) {
    return undefined
  }

  const activeYear = years.find(year => year.isActive)
  return activeYear?.id ?? years[0]?.id
}
