import { afterEach, describe, expect, it } from 'bun:test'
import {
  DEFAULT_LOCAL_API_URL,
  DEFAULT_LOCAL_APP_ORIGIN,
  DEFAULT_REMOTE_API_URL,
  DEFAULT_REMOTE_APP_ORIGIN,
  resolveLocalAppOrigin,
  resolveLocalSeedApiUrl,
  resolveRemoteAppOrigin,
  resolveRemoteSeedApiUrl,
} from '../../src/support/resolve-seed-env'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('resolve-seed-env', () => {
  it('resolves local API URL from SEED_API_URL then BETTER_AUTH_URL', () => {
    delete process.env.SEED_API_URL
    process.env.BETTER_AUTH_URL = 'http://localhost:8888'
    expect(resolveLocalSeedApiUrl()).toBe('http://localhost:8888')
  })

  it('defaults local URLs when unset', () => {
    delete process.env.SEED_API_URL
    delete process.env.BETTER_AUTH_URL
    delete process.env.SEED_APP_ORIGIN
    expect(resolveLocalSeedApiUrl()).toBe(DEFAULT_LOCAL_API_URL)
    expect(resolveLocalAppOrigin()).toBe(DEFAULT_LOCAL_APP_ORIGIN)
  })

  it('resolves remote URLs from SEED_REMOTE_* vars', () => {
    process.env.SEED_REMOTE_API_URL = 'https://api.example.com/'
    process.env.SEED_REMOTE_APP_ORIGIN = 'https://app.example.com/'
    expect(resolveRemoteSeedApiUrl()).toBe('https://api.example.com')
    expect(resolveRemoteAppOrigin()).toBe('https://app.example.com')
  })

  it('defaults remote URLs when unset', () => {
    delete process.env.SEED_REMOTE_API_URL
    delete process.env.SEED_REMOTE_APP_ORIGIN
    expect(resolveRemoteSeedApiUrl()).toBe(DEFAULT_REMOTE_API_URL)
    expect(resolveRemoteAppOrigin()).toBe(DEFAULT_REMOTE_APP_ORIGIN)
  })
})
