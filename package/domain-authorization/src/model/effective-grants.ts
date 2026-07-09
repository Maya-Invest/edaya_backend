import type { Permission } from '../permissions/permission'
import type { ScopeGrant } from './scope-grant'

export interface EffectiveGrants {
  readonly permissions: ReadonlySet<Permission>
  readonly scopeGrants: readonly ScopeGrant[]
  /**
   * Merged `scopeIds` per permission from `StaffPermissionAssignment` rows (new model).
   * When present, `scopeGrantCovers` prefers path matching over legacy `scopeGrants`.
   */
  readonly scopeIdsByPermission?: Readonly<Partial<Record<Permission, string>>>
  /** Admin / Principal: school-wide access without per-entity scope grants. */
  readonly isElevated: boolean
  /** Earliest grant expiry represented in this grant set, used to bound caches. */
  readonly expiresAt?: Date
}
