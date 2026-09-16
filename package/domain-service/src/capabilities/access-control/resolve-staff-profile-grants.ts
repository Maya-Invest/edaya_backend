import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { Permission } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AccessFacts, assertGrantDelegation } from '@edaya/authorization'
import { BusinessRuleViolationError, StaffPermissionAssignment } from '@edaya/core'
import { profileBoundGrantId } from './profile-bound-grant-id'

export async function resolveStaffProfileGrants(args: {
  actor?: SchoolScopedActorMetadata
  repositories: SchoolRepositories
  staffId: string
}): Promise<void> {
  const { actor, repositories, staffId } = args
  const staff = await repositories.staffMembers.findById(staffId)
  if (!staff) {
    throw new BusinessRuleViolationError('UNKNOWN_STAFF', `Unknown staff: ${staffId}`)
  }

  const bindings = [...await repositories.staffPermissionProfileBindings.list({ staffId })]
    .sort((left, right) => left.academicYearId.localeCompare(right.academicYearId)
      || left.sortOrder - right.sortOrder
      || left.id.localeCompare(right.id))

  const byYear = new Map<string, typeof bindings>()
  for (const binding of bindings) {
    const yearBindings = byYear.get(binding.academicYearId) ?? []
    yearBindings.push(binding)
    byYear.set(binding.academicYearId, yearBindings)
  }

  const now = new Date()
  const desired: StaffPermissionAssignment[] = []
  for (const [academicYearId, yearBindings] of byYear) {
    const claimed = new Set<Permission>()
    for (const binding of yearBindings) {
      const profile = await repositories.staffPermissionProfiles.findById(binding.profileId)
      if (!profile) {
        throw new BusinessRuleViolationError(
          'UNKNOWN_PERMISSION_PROFILE',
          `Unknown permission profile: ${binding.profileId}`,
        )
      }
      for (const permission of profile.permissions) {
        if (claimed.has(permission))
          continue
        claimed.add(permission)
        desired.push(new StaffPermissionAssignment({
          id: profileBoundGrantId(staffId, profile.id, permission),
          staffId,
          schoolId: staff.schoolId,
          academicYearId,
          permission,
          scopes: binding.scopes,
          status: 'active',
          sourceProfileId: profile.id,
          createdAt: now,
          updatedAt: now,
        }))
      }
    }
  }

  if (actor)
    await assertGrantDelegation(new AccessFacts(actor, repositories), desired)

  const existing = await repositories.staffPermissionAssignments.list({ staffId })
  const stamped = existing.filter(grant => grant.sourceProfileId)
  const existingById = new Map(stamped.map(grant => [grant.id, grant]))
  const desiredIds = new Set(desired.map(grant => grant.id))

  for (const grant of stamped) {
    if (!desiredIds.has(grant.id))
      await repositories.staffPermissionAssignments.delete(grant.id)
  }

  for (const grant of desired) {
    const before = existingById.get(grant.id)
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      ...grant.data,
      createdAt: before?.createdAt ?? grant.createdAt,
      updatedAt: now,
    }))
  }
}
