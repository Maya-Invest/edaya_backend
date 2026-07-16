import type { PermissionDefinition } from './permission-definition'
import { Permission, permissionScope } from '@edaya/core'

function buildDefinition(permission: Permission): PermissionDefinition {
  const scope = permissionScope(permission)
  return scope ? { permission, scope } : { permission }
}

export function buildPermissionDefinitions(): Record<Permission, PermissionDefinition> {
  const definitions = {} as Record<Permission, PermissionDefinition>
  for (const permission of Object.values(Permission)) {
    definitions[permission] = buildDefinition(permission)
  }
  return definitions
}
