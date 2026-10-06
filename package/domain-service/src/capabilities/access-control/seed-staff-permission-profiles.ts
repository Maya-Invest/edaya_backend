import type { SchoolRepositories } from '../../ports/school-repositories'
import { randomUUID } from 'node:crypto'
import { StaffPermissionProfile } from '@edaya/core'
import { STAFF_INVITE_PERMISSION_PRESETS } from '../onboarding/default-access-roles'

export async function ensureSchoolPermissionProfiles(repositories: Pick<SchoolRepositories, 'staffPermissionProfiles'>, schoolId: string): Promise<void> {
  if (await repositories.staffPermissionProfiles.count({ schoolId }) > 0)
    return
  for (const preset of STAFF_INVITE_PERMISSION_PRESETS) {
    await repositories.staffPermissionProfiles.save(new StaffPermissionProfile({
      id: randomUUID(),
      schoolId,
      name: preset.name,
      description: preset.description,
      permissions: [...preset.permissions],
      sourceKey: preset.id,
    }))
  }
}
