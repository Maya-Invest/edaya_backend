import type { Permission } from '../permissions/permission'
import type { ScopeType } from '../permissions/scope-type'

/** Limits a single permission to specific scope entities. */
export interface ScopeGrant {
  permission: Permission
  scopeType: ScopeType
  scopeEntityIds: readonly string[]
}
