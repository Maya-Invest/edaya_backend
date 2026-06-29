import { runHttpDevSeeds } from '@edaya/seeding/http'
import { describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed validation harness — HTTP validate scope', () => {
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
