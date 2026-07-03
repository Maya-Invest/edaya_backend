import type { Permission } from './permission'
import type { ScopeType } from './scope-type'

export interface PermissionDefinition {
  permission: Permission
  allowedScopes: readonly ScopeType[]
}
