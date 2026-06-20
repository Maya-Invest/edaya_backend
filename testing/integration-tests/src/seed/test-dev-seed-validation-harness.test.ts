import {
  assertSeedManifestComplete,
  buildSeedValidationTargets,
  countSeedStudents,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  resolveSeedExpectedCounts,
  seedManifestEntitiesByStatus,
} from '@edaya/dev-fixtures'
import { HttpSeedClient, runHttpDevSeeds } from '@edaya/seeding/http'
import { describe, expect, it } from 'bun:test'
import { apiPgliteEnv } from '../support/api-pglite-env'
import { createAppRequest, createCoreRouteTestApp } from '../support/api-route-harness'
import {
  describeSlowIntegration,
  describeWithSeededSchool,
  unwrapEntityList,
} from '../support/seeded-route-test-context'

function createHttpClientForApp(app: Awaited<ReturnType<typeof createCoreRouteTestApp>>['app']): HttpSeedClient {
  return new HttpSeedClient({
    baseUrl: apiPgliteEnv.BETTER_AUTH_URL,
    fetch: async (input, init) => {
      const url = new URL(input.toString())
      return await app.request(`${url.pathname}${url.search}`, init)
    },
  })
}

describe('dev seed validation harness', () => {
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
})

describeWithSeededSchool('dev seed validation harness — HTTP entity coverage', (getContext) => {
  it('lists all seeded entities through staff HTTP routes after full seed', async () => {
    const { app, authHeaders } = getContext()
    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)

    const failures: string[] = []
    for (const target of buildSeedValidationTargets()) {
      const response = await app.request(createAppRequest(`/core/entities/${target.entity}/list`, {
        method: 'POST',
        headers,
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
  })
})

describeSlowIntegration('dev seed validation harness — HTTP validate scope', () => {
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
