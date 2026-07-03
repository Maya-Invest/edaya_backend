import type { Permission } from '../permissions/permission'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { scopeIdsFromEntityIds } from '../scope/scope-ids-from-entities'

/**
 * Builds computed portal `scopeIdsByPermission` from linked students and active class groups.
 * Student-scoped catalog permissions use single-segment student ids; class-group permissions
 * use single-segment class group ids; tenant-wide permissions use `scopeIds: ""`.
 */
export function buildPortalScopeIdsByPermission(
  permissions: ReadonlySet<Permission>,
  args: {
    studentIds?: readonly string[]
    classGroupIds?: readonly string[]
  },
): Partial<Record<Permission, string>> {
  const scopeIdsByPermission: Partial<Record<Permission, string>> = {}
  const studentScopeIds = scopeIdsFromEntityIds(args.studentIds ?? [])
  const classGroupScopeIds = scopeIdsFromEntityIds(args.classGroupIds ?? [])

  for (const permission of permissions) {
    const catalogScope = permissionDefinitions[permission].scope
    if (!catalogScope) {
      scopeIdsByPermission[permission] = ''
    }
    else if (catalogScope === 'student') {
      scopeIdsByPermission[permission] = studentScopeIds
    }
    else if (catalogScope === 'class_group') {
      scopeIdsByPermission[permission] = classGroupScopeIds
    }
    else {
      scopeIdsByPermission[permission] = ''
    }
  }

  return scopeIdsByPermission
}
