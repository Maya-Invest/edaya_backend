import { afterEach, describe, expect, it } from 'bun:test'
import { assertLoopbackNativeFinanceResetUrl, assertRecordedFinanceSchoolId } from './assert-finance-reset-target'

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('assertLoopbackNativeFinanceResetUrl', () => {
  it('admits the native-runner loopback identity', () => {
    expect(assertLoopbackNativeFinanceResetUrl('postgres://edaya_rc@127.0.0.1:54329/postgres'))
      .toBe('postgres://edaya_rc@127.0.0.1:54329/postgres')
  })

  it('never falls back to DATABASE_URL', () => {
    process.env['DATABASE_URL'] = 'postgres://user:pass@ep-prod-123.us-east-1.aws.neon.tech/neondb'
    expect(() => assertLoopbackNativeFinanceResetUrl('')).toThrow(/never reads DATABASE_URL/)
  })

  it('rejects reusing DATABASE_URL even on loopback', () => {
    const url = 'postgres://edaya_rc@127.0.0.1:54329/postgres'
    expect(() => assertLoopbackNativeFinanceResetUrl(url, { DATABASE_URL: url })).toThrow(/reuse DATABASE_URL/)
  })

  it('rejects remote and production hosts', () => {
    expect(() => assertLoopbackNativeFinanceResetUrl(
      'postgres://user:pass@ep-prod-123.us-east-1.aws.neon.tech/neondb',
    )).toThrow(/127\.0\.0\.1/)
  })

  it('rejects recorded fixture identities that are not school ids', () => {
    expect(() => assertRecordedFinanceSchoolId('drop table students')).toThrow(/recorded fixture identity/)
  })
})
