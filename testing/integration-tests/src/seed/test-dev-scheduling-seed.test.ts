import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_PLANNING_SLOTS,
  SEED_RESOURCES,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
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

describe('dev scheduling seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds resources, schedules, sessions and lets teachers list sessions', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.resources).toBe(SEED_RESOURCES.length)
      expect(seedResult.schedules).toBe(SEED_PLANNING_SLOTS.length)
      expect(seedResult.sessions).toBe(SEED_PLANNING_SLOTS.length)
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const [sessionsResponse, resourcesResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/sessions/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/resources/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ])

    expect(sessionsResponse.status).toBe(200)
    expect(resourcesResponse.status).toBe(200)

    const sessions = unwrapEntityList<{ id: string, classGroupId: string, title: string }>(await sessionsResponse.json())
    const resources = unwrapEntityList<{ id: string, name: string }>(await resourcesResponse.json())

    expect(sessions.length).toBeGreaterThanOrEqual(SEED_PLANNING_SLOTS.length)
    expect(resources.length).toBeGreaterThanOrEqual(SEED_RESOURCES.length)
    expect(sessions.some(session => session.id === 'sess-p1' && session.classGroupId === '6a')).toBe(true)
    expect(resources.some(resource => resource.name === 'Gymnasium')).toBe(true)
  }, 30_000)
})
