import { runHttpDevSeeds } from '@edaya/seeding/http'
import { describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { bootstrapHttpSeedForDiagnostics } from '../../support/http-seed-bootstrap'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed doctor — HTTP doctor scope', () => {
  it('returns structured findings after scoped HTTP bootstrap', async () => {
    const { app, runtime, localFiles } = await createCoreRouteTestApp({
      withEmbeddedLocalFiles: true,
      autoCleanup: false,
    })
    const client = createHttpClientForApp(app)

    try {
      const serviceAccountApiKey = await bootstrapHttpSeedForDiagnostics(client, { withProfilePhotos: true })

      const doctor = await runHttpDevSeeds({
        client,
        scope: 'doctor',
        serviceAccountApiKey,
      })

      expect(doctor.doctor?.status).not.toBe('broken')
      expect(doctor.doctor?.findings.some(entry => entry.code === 'auth-present')).toBe(true)
      expect(doctor.doctor?.findings.some(entry => entry.code === 'demo-school-present')).toBe(true)
      expect(doctor.doctor?.findings.some(entry => entry.code === 'service-account-ready')).toBe(true)
    }
    finally {
      await runtime.close()
      localFiles?.stop()
    }
  }, 120_000)

  it('reports broken state when auth is missing', async () => {
    const { app, runtime } = await createCoreRouteTestApp()
    const client = createHttpClientForApp(app)

    try {
      const doctor = await runHttpDevSeeds({
        client,
        scope: 'doctor',
      })

      expect(doctor.doctor?.status).toBe('broken')
      expect(doctor.doctor?.findings.some(entry => entry.code === 'auth-missing')).toBe(true)
    }
    finally {
      await runtime.close()
    }
  }, 30_000)
})
