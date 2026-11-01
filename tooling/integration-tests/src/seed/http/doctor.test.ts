import { runHttpDevSeeds } from '@edaya/seeding/http'
import { describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed doctor — HTTP doctor scope', () => {
  it('reports broken state when auth is missing', async () => {
    const { app, runtime } = await createCoreRouteTestApp({ identity: 'live' })
    const client = createHttpClientForApp(app)

    try {
      const doctor = await runHttpDevSeeds({
        client,
        scope: 'doctor',
      })

      expect(doctor.doctor?.status).toBe('broken')
      expect(doctor.doctor?.findings.some(entry =>
        entry.code === 'auth-missing' || entry.code === 'school-missing',
      )).toBe(true)
    }
    finally {
      await runtime.close()
    }
  }, 30_000)
})
