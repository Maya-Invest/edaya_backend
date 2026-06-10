import type { Permission } from './permissions/permission'
import type { ScopeGrant } from './role-types'

export function buildPortalScopeGrants(
  permissions: ReadonlySet<Permission>,
  args: {
    studentIds?: readonly string[]
    classGroupIds?: readonly string[]
  },
): ScopeGrant[] {
  const grants: ScopeGrant[] = []

  if (args.studentIds?.length) {
    const studentIds = [...args.studentIds]
    for (const permission of permissions) {
      grants.push({
        permission,
        scopeType: 'student',
        scopeEntityIds: studentIds,
      })
    }
  }

  if (args.classGroupIds?.length) {
    const classGroupIds = [...args.classGroupIds]
    for (const permission of permissions) {
      grants.push({
        permission,
        scopeType: 'class_group',
        scopeEntityIds: classGroupIds,
      })
    }
  }

  return grants
}
