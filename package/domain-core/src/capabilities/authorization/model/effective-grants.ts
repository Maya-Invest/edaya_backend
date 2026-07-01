import type { Permission } from '../permissions/permission'
import type { ScopeGrant } from './scope-grant'

export interface EffectiveGrants {
  readonly permissions: ReadonlySet<Permission>
  readonly scopeGrants: readonly ScopeGrant[]
  /** Admin / Principal: school-wide access without per-entity scope grants. */
  readonly isElevated: boolean
  /** Earliest grant expiry represented in this grant set, used to bound caches. */
  readonly expiresAt?: Date
}
