import { afterEach, describe, expect, it } from 'bun:test'
import {
  DEFAULT_LOCAL_API_URL,
  DEFAULT_LOCAL_AUTH_URL,
  DEFAULT_LOCAL_APP_ORIGIN,
  DEFAULT_STAGING_API_URL,
  DEFAULT_STAGING_AUTH_URL,
  DEFAULT_STAGING_APP_ORIGIN,
  isStagingSeedApiUrl,
  resolveLocalAppOrigin,
  resolveLocalSeedApiUrl,
  resolveLocalSeedAuthUrl,
  resolveStagingAppOrigin,
  resolveStagingSeedApiUrl,
  resolveStagingSeedAuthUrl,
} from '../../src/support/resolve-seed-env'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('resolve-seed-env', () => {
  it('resolves separate local school and identity URLs', () => {
    process.env.SEED_API_URL = 'http://localhost:8888'
    process.env.SEED_AUTH_URL = 'http://localhost:9901'
    expect(resolveLocalSeedApiUrl()).toBe('http://localhost:8888')
    expect(resolveLocalSeedAuthUrl()).toBe('http://localhost:9901')
  })

  it('defaults local URLs when unset', () => {
    delete process.env.SEED_API_URL
    delete process.env.SEED_AUTH_URL
    delete process.env.SEED_APP_ORIGIN
    expect(resolveLocalSeedApiUrl()).toBe(DEFAULT_LOCAL_API_URL)
    expect(resolveLocalSeedAuthUrl()).toBe(DEFAULT_LOCAL_AUTH_URL)
    expect(resolveLocalAppOrigin()).toBe(DEFAULT_LOCAL_APP_ORIGIN)
  })

  it('resolves staging URLs from SEED_STAGING_* vars', () => {
    process.env.SEED_STAGING_API_URL = 'https://api.example.com/'
    process.env.SEED_STAGING_AUTH_URL = 'https://identity.example.com/'
    process.env.SEED_STAGING_APP_ORIGIN = 'https://app.example.com/'
    expect(resolveStagingSeedApiUrl()).toBe('https://api.example.com')
    expect(resolveStagingSeedAuthUrl()).toBe('https://identity.example.com')
    expect(resolveStagingAppOrigin()).toBe('https://app.example.com')
  })

  it('defaults staging URLs when unset', () => {
    delete process.env.SEED_STAGING_API_URL
    delete process.env.SEED_STAGING_AUTH_URL
    delete process.env.SEED_STAGING_APP_ORIGIN
    expect(resolveStagingSeedApiUrl()).toBe(DEFAULT_STAGING_API_URL)
    expect(resolveStagingSeedAuthUrl()).toBe(DEFAULT_STAGING_AUTH_URL)
    expect(resolveStagingAppOrigin()).toBe(DEFAULT_STAGING_APP_ORIGIN)
  })

  it('detects staging API hostnames', () => {
    expect(isStagingSeedApiUrl('https://staging.school.api.edayaplus.com')).toBe(true)
    expect(isStagingSeedApiUrl('https://staging.api.school.edayaplus.com')).toBe(true)
    expect(isStagingSeedApiUrl('https://staging.api.edayaplus.com')).toBe(true)
    expect(isStagingSeedApiUrl('https://api-staging.example.com')).toBe(true)
    expect(isStagingSeedApiUrl('https://school.api.edayaplus.com')).toBe(false)
    expect(isStagingSeedApiUrl('https://api.edayaplus.com')).toBe(false)
    expect(isStagingSeedApiUrl('http://localhost:9999')).toBe(false)
  })
})
