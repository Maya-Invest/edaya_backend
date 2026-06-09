import type { SchoolRepositories } from '../../ports'
import { AccessRole, StaffRole } from '../../domains'
import { SYSTEM_ROLE_PERMISSIONS } from '../system-role-permissions'
import { SYSTEM_ACCESS_ROLE_LABELS, systemAccessRoleId } from './system-role-ids'

export async function ensureSystemAccessRolesForSchool(
  schoolId: string,
  repositories: SchoolRepositories,
): Promise<readonly AccessRole[]> {
  const saved: AccessRole[] = []

  for (const staffRole of Object.values(StaffRole)) {
    const role = new AccessRole({
      id: systemAccessRoleId(schoolId, staffRole),
      schoolId,
      name: SYSTEM_ACCESS_ROLE_LABELS[staffRole],
      isSystemRole: true,
      systemRoleKey: staffRole,
      permissions: [...SYSTEM_ROLE_PERMISSIONS[staffRole]],
      status: 'active',
    })

    const existing = await repositories.accessRoles.findById(role.id)
    if (existing) {
      saved.push(existing)
      continue
    }

    await repositories.accessRoles.save(role)
    saved.push(role)
  }

  return saved
}
