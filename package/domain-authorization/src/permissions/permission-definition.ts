import type { Permission } from './permission'
import type { ScopeType } from './scope-type'

export interface PermissionDefinition {
  permission: Permission
  /** When omitted, permission is tenant-wide within the school (`{ kind: "school" }`). */
  scope?: ScopeType
}
