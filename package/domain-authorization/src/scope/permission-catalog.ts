import type { Permission } from '../permissions/permission'
import type { PermissionDefinition } from '../permissions/permission-definition'
import { permissionDefinitions } from '../permissions/permission-definitions'

export function listPermissionCatalog(): readonly PermissionDefinition[] {
  return Object.freeze(Object.values(permissionDefinitions))
}

export function getPermissionCatalogEntry(permission: Permission): PermissionDefinition {
  return permissionDefinitions[permission]
}
