import type { AuthCacheInvalidationPort } from '../../../ports/gateways/auth-cache-invalidation'
import type { AuthCacheInvalidationEvent } from './types'

export function invalidateAuthCacheForEvent(
  event: AuthCacheInvalidationEvent,
  port: AuthCacheInvalidationPort,
): void {
  port.invalidateForEvent(event)
}

export function invalidateAuthCacheForEvents(
  events: readonly AuthCacheInvalidationEvent[],
  port: AuthCacheInvalidationPort,
): void {
  for (const event of events) {
    invalidateAuthCacheForEvent(event, port)
  }
}
