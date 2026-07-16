import type { AuthCacheInvalidationEvent } from '../lifecycle/types'

export interface AuthCacheInvalidationPort {
  invalidateForEvent: (event: AuthCacheInvalidationEvent) => void
}
