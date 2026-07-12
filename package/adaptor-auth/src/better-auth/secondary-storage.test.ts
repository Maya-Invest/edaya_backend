import { describe, expect, it } from 'bun:test'
import { createInMemoryAuthSecondaryStorage } from '../adapters/in-memory-auth-secondary-storage'
import {
  CLOUDFLARE_KV_MIN_TTL_SECONDS,
  createKvAuthSecondaryStorage,
  isAuthKeyValueStore,
  resolveKvExpirationTtlSeconds,
} from '../adapters/key-value-store'
import {
  buildBetterAuthRateLimitOptions,
  buildBetterAuthSessionOptions,
  toBetterAuthSecondaryStorage,
} from '../better-auth/secondary-storage'

describe('resolveKvExpirationTtlSeconds', () => {
  it('enforces Cloudflare KV minimum TTL', () => {
    expect(resolveKvExpirationTtlSeconds(10_000)).toBe(CLOUDFLARE_KV_MIN_TTL_SECONDS)
    expect(resolveKvExpirationTtlSeconds(120_000)).toBe(120)
  })
})

describe('createKvAuthSecondaryStorage', () => {
  it('maps ttlMs to KV expirationTtl seconds', async () => {
    const writes: Array<{ key: string; value: string; expirationTtl?: number }> = []
    const store = createKvAuthSecondaryStorage({
      get: async () => null,
      put: async (key, value, options) => {
        writes.push({ key, value, expirationTtl: options?.expirationTtl })
      },
      delete: async () => {},
    })

    await store.set('session:1', '{"id":"1"}', 90_000)

    expect(writes).toEqual([{
      key: 'session:1',
      value: '{"id":"1"}',
      expirationTtl: 90,
    }])
  })
})

describe('createInMemoryAuthSecondaryStorage', () => {
  it('expires values after ttlMs', async () => {
    const storage = createInMemoryAuthSecondaryStorage()

    await storage.set('session:1', 'value', 1)
    expect(await storage.get('session:1')).toBe('value')

    await new Promise(resolve => setTimeout(resolve, 5))
    expect(await storage.get('session:1')).toBeNull()
  })
})

describe('toBetterAuthSecondaryStorage', () => {
  it('bridges the port into Better Auth config shape', async () => {
    const storage = createInMemoryAuthSecondaryStorage()
    const secondaryStorage = toBetterAuthSecondaryStorage(storage)

    await secondaryStorage.set('session:1', '{"id":"1"}', 60_000)
    expect(await secondaryStorage.get('session:1')).toBe('{"id":"1"}')
    await secondaryStorage.delete('session:1')
    expect(await secondaryStorage.get('session:1')).toBeNull()
  })
})

describe('buildBetterAuthSessionOptions', () => {
  it('keeps Postgres authoritative when secondary storage is enabled', () => {
    const storage = createInMemoryAuthSecondaryStorage()

    expect(buildBetterAuthSessionOptions()).toEqual({
      storeSessionInDatabase: false,
      cookieCache: { enabled: false },
    })
    expect(buildBetterAuthSessionOptions({ secondaryStorage: storage })).toEqual({
      storeSessionInDatabase: true,
      cookieCache: { enabled: false },
    })
  })
})

describe('buildBetterAuthRateLimitOptions', () => {
  it('only enables KV-safe rate limits when secondary storage is present', () => {
    const storage = createInMemoryAuthSecondaryStorage()

    expect(buildBetterAuthRateLimitOptions()).toBeUndefined()
    expect(buildBetterAuthRateLimitOptions({ secondaryStorage: storage })).toEqual({
      enabled: true,
      window: CLOUDFLARE_KV_MIN_TTL_SECONDS,
      max: 100,
    })
  })
})

describe('isAuthKeyValueStore', () => {
  it('accepts duck-typed KV bindings', () => {
    expect(isAuthKeyValueStore({
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    })).toBe(true)
    expect(isAuthKeyValueStore({ get: async () => null })).toBe(false)
  })
})
