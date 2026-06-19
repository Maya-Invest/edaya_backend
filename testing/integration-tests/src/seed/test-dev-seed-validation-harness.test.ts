import {
  assertSeedManifestComplete,
  buildSeedValidationTargets,
  countSeedStudents,
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  resolveSeedExpectedCounts,
  seedManifestEntitiesByStatus,
} from '@edaya/dev-fixtures'
import {
  createHandlerAuthProvisioner,
  runDevAccessSeed,
  runDevAuthLink,
  runDevSchoolSeed,
} from '@edaya/seeding'
import { HttpSeedClient, runHttpDevSeeds } from '@edaya/seeding/http'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { apiPgliteEnv } from '../support/api-pglite-env'

import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

function createHttpClientForApp(app: Awaited<ReturnType<typeof createCoreRouteTestApp>>['app']): HttpSeedClient {
  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.BETTER_AUTH_URL,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}

function unwrapEntityList(values: unknown): unknown[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: unknown }).data
    }
    return entry
  })
}

describe('dev seed validation harness', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('has no missing entities in the manifest', () => {
    expect(seedManifestEntitiesByStatus('missing')).toHaveLength(0)
    expect(() => assertSeedManifestComplete()).not.toThrow()
  })

  it('maps manifest entities to expected fixture counts', () => {
    const counts = resolveSeedExpectedCounts()
    const targets = buildSeedValidationTargets()

    expect(targets.length).toBeGreaterThan(40)
    expect(counts.students).toBe(countSeedStudents())
    expect(targets.find(target => target.entity === 'students')?.minCount).toBe(30)
    expect(targets.find(target => target.entity === 'guardians')?.minCount).toBeGreaterThanOrEqual(20)
  })

  it('lists all seeded entities through staff HTTP routes after full seed', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')

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

    const failures: string[] = []
    for (const target of buildSeedValidationTargets()) {
      const response = await app.request(createAppRequest(`/core/entities/${target.entity}/list`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      }))
      if (response.status !== 200) {
        failures.push(`${target.entity}: HTTP ${response.status}`)
        continue
      }
      const rows = unwrapEntityList(await response.json())
      if (rows.length < target.minCount) {
        failures.push(`${target.entity}: expected >= ${target.minCount}, got ${rows.length}`)
      }
    }

    expect(failures).toEqual([])
  }, 60_000)

  it('runs HTTP validate scope after full seed', async () => {
    const { app, application } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    await runHttpDevSeeds({
      client,
      scope: 'all',
      application,
    })

    const validation = await runHttpDevSeeds({
      client,
      scope: 'validate',
      application,
    })

    expect(validation.validation?.status).toBe('passed')
    expect(validation.validation?.failures ?? []).toEqual([])
    expect(validation.validation?.entities.every(entry => entry.status === 'passed')).toBe(true)
    expect(validation.validation?.queries.every(entry => entry.status === 'passed')).toBe(true)
  }, 90_000)
})
