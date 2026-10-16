import { demoCiDataset } from '@edaya/fixtures'
import { buildSeedProfileAttachmentId } from '@edaya/fixtures/shared/profile-pictures'
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
      identity: 'live',
    })
    const client = createHttpClientForApp(app)

    try {
      const serviceAccountApiKey = await bootstrapHttpSeedForDiagnostics(client, { withProfilePhotos: true })

      const headers = { authorization: `Bearer ${serviceAccountApiKey}` }
      for (const teacher of demoCiDataset.entities.teachers ?? []) {
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
    }
    finally {
      await runtime.close()
      localFiles?.stop()
    }
  // Full HTTP fixtures include password hashing, permission trees, and private photo uploads.
  }, 600_000)
})
