import { afterEach, describe, expect, it } from 'bun:test'
import { assertStagingIdentityDatabaseUrl, isLocalAuthDatabaseUrl } from './assert-identity-wipe-allowed'

const ENV_KEYS = ['SEED_ALLOW_DESTRUCTIVE'] as const

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
})

describe('isLocalAuthDatabaseUrl', () => {
  it('treats missing, memory, and pglite URLs as local', () => {
    expect(isLocalAuthDatabaseUrl(undefined)).toBe(true)
    expect(isLocalAuthDatabaseUrl('pglite')).toBe(true)
    expect(isLocalAuthDatabaseUrl('pglite:.data/identity')).toBe(true)
    expect(isLocalAuthDatabaseUrl('memory')).toBe(true)
  })

  it('treats postgres URLs as remote', () => {
    expect(isLocalAuthDatabaseUrl('postgres://localhost/auth')).toBe(false)
  })
})

describe('assertStagingIdentityDatabaseUrl', () => {
  it('allows staging-looking hostnames', () => {
    expect(() => assertStagingIdentityDatabaseUrl('postgres://ep-staging-xyz.neon.tech/neondb')).not.toThrow()
  })

  it('blocks production-looking URLs without an override', () => {
    expect(() => assertStagingIdentityDatabaseUrl('postgres://ep-cool-name.neon.tech/neondb')).toThrow(/does not look like a staging branch/)
  })

  it('allows an explicit destructive override', () => {
    process.env['SEED_ALLOW_DESTRUCTIVE'] = 'true'
    expect(() => assertStagingIdentityDatabaseUrl('postgres://ep-cool-name.neon.tech/neondb')).not.toThrow()
  })

  it('refuses pglite for staging wipe', () => {
    expect(() => assertStagingIdentityDatabaseUrl('pglite:.data/identity')).toThrow(/local\/ephemeral/)
  })
})
