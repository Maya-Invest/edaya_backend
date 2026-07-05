/* eslint-disable dot-notation -- bracket access required by tsc for process.env index signature */
import { afterEach, describe, expect, it } from 'bun:test'
import { assertStagingSchoolDatabaseUrl, isLocalDatabaseUrl } from './database-url-guard'

describe('database-url-guard', () => {
  const previousAllowDestructive = process.env['SEED_ALLOW_DESTRUCTIVE']

  afterEach(() => {
    if (previousAllowDestructive === undefined) {
      delete process.env['SEED_ALLOW_DESTRUCTIVE']
    }
    else {
      process.env['SEED_ALLOW_DESTRUCTIVE'] = previousAllowDestructive
    }
  })

  it('detects local database urls', () => {
    expect(isLocalDatabaseUrl(undefined)).toBe(true)
    expect(isLocalDatabaseUrl('pglite')).toBe(true)
    expect(isLocalDatabaseUrl('pglite:.data/school')).toBe(true)
    expect(isLocalDatabaseUrl('postgres://user:pass@staging.example/db')).toBe(false)
  })

  it('allows staging-looking Neon urls', () => {
    expect(() => assertStagingSchoolDatabaseUrl(
      'postgres://user:pass@ep-staging-123.us-east-2.aws.neon.tech/neondb',
    )).not.toThrow()
  })

  it('allows wipe when SEED_REMOTE_API_URL targets staging', () => {
    process.env['SEED_REMOTE_API_URL'] = 'https://api-staging.edaya.softilab.dev'
    expect(() => assertStagingSchoolDatabaseUrl(
      'postgres://user:pass@ep-ancient-darkness-ahtbz5cm.us-east-1.aws.neon.tech/neondb',
    )).not.toThrow()
    delete process.env['SEED_REMOTE_API_URL']
  })

  it('blocks non-staging urls unless explicitly allowed', () => {
    expect(() => assertStagingSchoolDatabaseUrl(
      'postgres://user:pass@ep-prod-123.us-east-2.aws.neon.tech/neondb',
    )).toThrow(/does not look like a staging branch/)

    process.env['SEED_ALLOW_DESTRUCTIVE'] = 'true'
    expect(() => assertStagingSchoolDatabaseUrl(
      'postgres://user:pass@ep-prod-123.us-east-2.aws.neon.tech/neondb',
    )).not.toThrow()
  })
})
