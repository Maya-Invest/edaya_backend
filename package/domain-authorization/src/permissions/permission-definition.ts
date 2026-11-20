import type { CorePermissionDefinition, Permission } from '@edaya/core'

export interface PermissionDefinition extends CorePermissionDefinition {
  permission: Permission
}
