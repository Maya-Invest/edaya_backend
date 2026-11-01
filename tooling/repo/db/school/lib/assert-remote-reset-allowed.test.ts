import { afterEach, describe, expect, it } from 'bun:test'
import { assertRemoteResetAllowed } from './assert-remote-reset-allowed'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('assertRemoteResetAllowed', () => {
  it('allows staging URLs for staging reset', () => {
    expect(() => assertRemoteResetAllowed(
      'staging',
      'postgres://user:pass@ep-staging-123.us-east-1.aws.neon.tech/neondb',
    )).not.toThrow()
  })

  it('blocks production-looking URLs for staging reset', () => {
    expect(() => assertRemoteResetAllowed(
      'staging',
      'postgres://user:pass@ep-prod-123.us-east-1.aws.neon.tech/neondb',
    )).toThrow(/does not look like a staging branch/)
  })

  it('blocks staging-looking URLs for production reset', () => {
    expect(() => assertRemoteResetAllowed(
      'production',
      'postgres://user:pass@ep-staging-123.us-east-1.aws.neon.tech/neondb',
    )).toThrow(/looks like a staging branch/)
  })

  it('allows override with SEED_ALLOW_DESTRUCTIVE', () => {
    process.env['SEED_ALLOW_DESTRUCTIVE'] = 'true'
    expect(() => assertRemoteResetAllowed(
      'production',
      'postgres://user:pass@ep-staging-123.us-east-1.aws.neon.tech/neondb',
    )).not.toThrow()
  })
})
