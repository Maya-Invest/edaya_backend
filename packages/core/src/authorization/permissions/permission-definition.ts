import type { Permission } from './permission'
import type { ScopeType } from './scope-type'

export interface PermissionDefinition {
  permission: Permission
  label: string
  description: string
  allowedScopes: readonly ScopeType[]
  defaultScope: ScopeType
}

export interface PermissionDefinitionOverride {
  label?: string
  description?: string
  allowedScopes?: readonly ScopeType[]
  defaultScope?: ScopeType
}
