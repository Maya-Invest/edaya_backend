import { demoCiDataset } from '@edaya/fixtures'
import { buildSeedProfileAttachmentId } from '@edaya/fixtures/shared/profile-pictures'
import { runHttpDevSeeds } from '@edaya/seeding/http'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { bootstrapHttpSeedForDiagnostics } from '../../support/http-seed-bootstrap'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed validation harness — HTTP validate scope', () => {
  let context: Awaited<ReturnType<typeof createCoreRouteTestApp>>
  let serviceAccountApiKey: string
  beforeAll(async () => {
    context = await createCoreRouteTestApp({ withEmbeddedLocalFiles: true, autoCleanup: false, identity: 'live' })
    serviceAccountApiKey = await bootstrapHttpSeedForDiagnostics(createHttpClientForApp(context.app), { withProfilePhotos: true })
  }, 600_000)
  afterAll(async () => {
    try {
      await context?.runtime.close()
    }
    finally {
      context?.localFiles?.stop()
    }
  })

  it('runs HTTP validate scope after scoped bootstrap', async () => {
    const client = createHttpClientForApp(context.app)
    const headers = { authorization: `Bearer ${serviceAccountApiKey}` }
    // Exhaustive photo population belongs to seed/contract; this exercises real HTTP storage.
    for (const teacher of (demoCiDataset.entities.teachers ?? []).slice(0, 1)) {
      const attachmentId = buildSeedProfileAttachmentId('teacher', teacher.id)
      const saved = await client.jsonRequest<{ photoUrl?: string }>(`/core/entities/teachers/${teacher.id}`, { headers })
      expect(saved.response.status).toBe(200)
      expect(saved.body).toMatchObject({ firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email })
      expect(saved.body?.photoUrl).toBe(`${client.origin}/core/files/${attachmentId}/content`)
      const grant = await client.jsonRequest<{ downloadUrl: string }>(`/core/files/${attachmentId}/download-url`, { headers })
      expect(grant.response.status).toBe(200)
      const image = await client.request(grant.body!.downloadUrl)
      expect(image.status).toBe(200)
      expect(image.headers.get('content-type')).toBe('image/jpeg')
      expect(new Uint8Array(await image.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0xFF, 0xD8]))
    }

    const validation = await runHttpDevSeeds({
      client,
      scope: 'validate',
    })

    expect(validation.validation?.status).toBe('passed')
    expect(validation.validation?.failures ?? []).toEqual([])
    expect(validation.validation?.entities.every(entry => entry.status === 'passed')).toBe(true)
    expect(validation.validation?.queries.every(entry => entry.status === 'passed')).toBe(true)
  }, 600_000)

  it('returns structured doctor findings from the same healthy HTTP bootstrap', async () => {
    const doctor = await runHttpDevSeeds({ client: createHttpClientForApp(context.app), scope: 'doctor', serviceAccountApiKey })
    expect(doctor.doctor?.status).not.toBe('broken')
    for (const code of ['auth-present', 'demo-school-present', 'service-account-ready'])
      expect(doctor.doctor?.findings.some(entry => entry.code === code)).toBe(true)
  })
})
