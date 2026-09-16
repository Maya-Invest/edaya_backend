import type { Permission, PermissionProfileScopeGrain } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { PERMISSION_PROFILE_GRAIN_ORDER, profileGrainForPermission, StaffPermissionProfile } from '@edaya/core'
import { randomUUID } from 'node:crypto'
import { STAFF_INVITE_PERMISSION_PRESETS, type StaffInvitePermissionPreset } from '../onboarding/default-access-roles'

const GRAIN_LABELS: Record<PermissionProfileScopeGrain, string> = {
  school: '',
  class_group: 'classes',
  class_subject: 'subjects',
  student: 'students',
  grade_level: 'grade levels',
  grade_level_subject: 'grade subjects',
  activity: 'activities',
}

export interface SplitInvitePermissionProfile {
  sourceKey: string
  name: string
  description: string
  scopeGrain: PermissionProfileScopeGrain
  permissions: Permission[]
}

export function splitInvitePresetIntoProfiles(preset: StaffInvitePermissionPreset): SplitInvitePermissionProfile[] {
  const byGrain = new Map<PermissionProfileScopeGrain, Permission[]>()
  for (const permission of preset.permissions) {
    const grain = profileGrainForPermission(permission)
    if (!grain)
      continue
    const list = byGrain.get(grain) ?? []
    list.push(permission)
    byGrain.set(grain, list)
  }

  return PERMISSION_PROFILE_GRAIN_ORDER.flatMap((grain) => {
    const permissions = byGrain.get(grain)
    if (!permissions?.length)
      return []
    const label = GRAIN_LABELS[grain]
    return [{
      sourceKey: grain === 'school' ? preset.id : `${preset.id}:${grain}`,
      name: label ? `${preset.name} (${label})` : preset.name,
      description: preset.description,
      scopeGrain: grain,
      permissions,
    }]
  })
}

export async function ensureSchoolPermissionProfiles(
  repositories: Pick<SchoolRepositories, 'staffPermissionProfiles'>,
  schoolId: string,
): Promise<void> {
  const existing = await repositories.staffPermissionProfiles.count({ schoolId })
  if (existing > 0)
    return

  const now = new Date()
  for (const preset of STAFF_INVITE_PERMISSION_PRESETS) {
    for (const fragment of splitInvitePresetIntoProfiles(preset)) {
      await repositories.staffPermissionProfiles.save(new StaffPermissionProfile({
        id: randomUUID(),
        schoolId,
        name: fragment.name,
        description: fragment.description,
        scopeGrain: fragment.scopeGrain,
        permissions: fragment.permissions,
        sourceKey: fragment.sourceKey,
        createdAt: now,
        updatedAt: now,
      }))
    }
  }
}

export function inviteRoleSourceKeys(roleId: string): string[] {
  const preset = STAFF_INVITE_PERMISSION_PRESETS.find(candidate => candidate.id === roleId)
  if (!preset)
    return []
  return splitInvitePresetIntoProfiles(preset).map(fragment => fragment.sourceKey)
}

