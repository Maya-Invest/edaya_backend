import { runHttpDevSeeds } from '@edaya/seeding/http'
import { describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { bootstrapHttpSeedForDiagnostics } from '../../support/http-seed-bootstrap'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed validation harness — HTTP validate scope', () => {
  it('runs HTTP validate scope after scoped bootstrap', async () => {
    const { app, runtime, localFiles } = await createCoreRouteTestApp({
      withEmbeddedLocalFiles: true,
      autoCleanup: false,
    })
    const client = createHttpClientForApp(app)

    try {
      await bootstrapHttpSeedForDiagnostics(client, { withProfilePhotos: true })

      const validation = await runHttpDevSeeds({
        client,
        scope: 'validate',
      })

      expect(validation.validation?.status).toBe('passed')
      expect(validation.validation?.failures ?? []).toEqual([])
      expect(validation.validation?.entities.every(entry => entry.status === 'passed')).toBe(true)
      expect(validation.validation?.queries.every(entry => entry.status === 'passed')).toBe(true)
    }
    finally {
      await runtime.close()
      localFiles?.stop()
    }
  }, 120_000)
})
