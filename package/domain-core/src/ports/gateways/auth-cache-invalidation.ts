import type { AuthCacheInvalidationEvent } from '../../capabilities/authorization/lifecycle/types'

export interface AuthCacheInvalidationPort {
  invalidateForEvent: (event: AuthCacheInvalidationEvent) => void
}
