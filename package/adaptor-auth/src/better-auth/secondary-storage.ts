import type { AuthSecondaryStoragePort } from '../ports/auth-secondary-storage'
import { CLOUDFLARE_KV_MIN_TTL_SECONDS } from '../adapters/key-value-store'

export const BETTER_AUTH_KV_RATE_LIMIT_WINDOW_SECONDS = CLOUDFLARE_KV_MIN_TTL_SECONDS

export interface BetterAuthSecondaryStorageConfig {
  get: (key: string) => Promise<string | null | undefined>
  set: (key: string, value: string, ttl?: number) => Promise<void>
  delete: (key: string) => Promise<void>
}

export function toBetterAuthSecondaryStorage(
  port: AuthSecondaryStoragePort,
): BetterAuthSecondaryStorageConfig {
  return {
    get: key => port.get(key),
    set: (key, value, ttl) => port.set(key, value, ttl),
    delete: key => port.delete(key),
  }
}

export function buildBetterAuthSessionOptions(options?: {
  secondaryStorage?: AuthSecondaryStoragePort
}) {
  return {
    storeSessionInDatabase: options?.secondaryStorage !== undefined,
    cookieCache: {
      enabled: false,
    },
  } as const
}

export function buildBetterAuthRateLimitOptions(options?: {
  secondaryStorage?: AuthSecondaryStoragePort
}) {
  if (!options?.secondaryStorage) {
    return undefined
  }

  return {
    enabled: true,
    window: BETTER_AUTH_KV_RATE_LIMIT_WINDOW_SECONDS,
    max: 100,
  } as const
}
