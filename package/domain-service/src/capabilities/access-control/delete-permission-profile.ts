import type { StaffPermissionProfile } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { resolveStaffProfileGrants } from './resolve-staff-profile-grants'

const pendingCatalogDeleteStaffIds = new WeakMap<object, string[]>()

export async function preparePermissionProfileCatalogDelete(
  profile: StaffPermissionProfile,
  repositories: SchoolRepositories,
): Promise<void> {
  const bindings = await repositories.staffPermissionProfileBindings.list({ profileId: profile.id })
  const staffIds = [...new Set(bindings.map(binding => binding.staffId))]
  pendingCatalogDeleteStaffIds.set(profile, staffIds)

  for (const staffId of staffIds) {
    const staffBindings = await repositories.staffPermissionProfileBindings.list({ staffId })
    const remainingIds = staffBindings
      .filter(binding => binding.profileId !== profile.id)
      .map(binding => binding.profileId)
    const remaining = await repositories.staffPermissionProfiles.findByIds(remainingIds)
    const remainingPermissions = new Set(remaining.flatMap(candidate => candidate.permissions))
    const stamped = (await repositories.staffPermissionAssignments.list({ staffId }))
      .filter(grant => grant.sourceProfileId === profile.id)
    for (const grant of stamped) {
      if (remainingPermissions.has(grant.permission))
        await repositories.staffPermissionAssignments.delete(grant.id)
    }
  }
}

export async function finishPermissionProfileCatalogDelete(
  profile: StaffPermissionProfile,
  repositories: SchoolRepositories,
): Promise<void> {
  const staffIds = pendingCatalogDeleteStaffIds.get(profile) ?? []
  pendingCatalogDeleteStaffIds.delete(profile)
  for (const staffId of staffIds)
    await resolveStaffProfileGrants({ repositories, staffId })
}
