import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_TEACHING_LOG_ENTRIES,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/lib/runtime/registry'
import { apiPgliteEnv } from '../support/api-pglite-env'

import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data
    }
    return entry as T
  })
}

describe('dev teaching log seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds class logbook entries and exposes them via entity routes', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.classLogbookEntries).toBe(SEED_TEACHING_LOG_ENTRIES.length)
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DEV_AUTH_STAFF_ACCOUNTS[1].email, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const entriesResponse = await app.request(createAppRequest('/core/entities/class-logbook-entries/list', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    }))

    expect(entriesResponse.status).toBe(200)

    const entries = unwrapEntityList<{
      id: string
      classGroupId: string
      classSubjectId: string
      chapter: string
      homework?: string
      progress: number
    }>(await entriesResponse.json())

    const class6aEntries = entries.filter(entry => entry.classGroupId === '6a')

    expect(entries.length).toBe(SEED_TEACHING_LOG_ENTRIES.length)
    expect(class6aEntries.length).toBe(SEED_TEACHING_LOG_ENTRIES.filter(entry => entry.classGroupId === '6a').length)
    expect(entries.some(entry => entry.id === 'tle-cs-6a-math-0' && entry.classSubjectId === 'cs-6a-math')).toBe(true)
    expect(entries.some(entry => entry.id === 'tle-cs-6a-math-0' && entry.homework === 'Manuel p.84 ex. 12 à 18')).toBe(true)
    expect(entries.some(entry => entry.id === 'tle-cs-term-advmath-0')).toBe(true)
  }, 30_000)
})
