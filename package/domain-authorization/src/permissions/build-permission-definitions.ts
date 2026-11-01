import type { PermissionDefinition } from './permission-definition'
import { corePermissionDefinition, Permission } from '@edaya/core'

function buildDefinition(permission: Permission): PermissionDefinition {
  return { permission, ...corePermissionDefinition(permission) }
}

export function buildPermissionDefinitions(): Record<Permission, PermissionDefinition> {
  const definitions = {} as Record<Permission, PermissionDefinition>
  for (const permission of Object.values(Permission)) {
    definitions[permission] = buildDefinition(permission)
  }
  return definitions
}
