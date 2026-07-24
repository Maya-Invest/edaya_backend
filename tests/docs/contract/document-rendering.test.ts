import { describe, expect, test } from 'bun:test'
import { createDocsApp } from '../../../apps/docs/src/composition.ts'
import { DOCUMENT_RENDERING_FAILURES } from '../../../package/document-contracts/src/index.ts'
import { EXAMPLE_RENDER_REQUEST } from '../../../package/document-rendering/src/testing/examples.ts'
import { createRecordingObjectStorage } from '../../../package/document-rendering/src/testing/recording-storage.ts'

describe('document-rendering.v1 HTTP contract', () => {
  const app = createDocsApp({
    auth: { devToken: 'test-token' },
  })

  test('GET /health returns ok', async () => {
    const response = await app.request('/health')
    expect(response.status).toBe(200)
    const body = await response.json() as { status: string }
    expect(body).toEqual({ status: 'ok' })
  })

  test('POST /v1/render rejects missing auth', async () => {
    const response = await app.request('/v1/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(EXAMPLE_RENDER_REQUEST),
    })
    expect(response.status).toBe(401)
  })

  test('POST /v1/render returns inline PDF bytes', async () => {
    const response = await app.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(EXAMPLE_RENDER_REQUEST),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as {
      renderId: string
      contentType: string
      sha256: string
      bytesBase64: string
    }
    expect(body.contentType).toBe('application/pdf')
    expect(body.bytesBase64.length).toBeGreaterThan(0)
    expect(body.renderId.startsWith('rnd_')).toBe(true)
  })

  test('POST /v1/render rejects disallowed template', async () => {
    const response = await app.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...EXAMPLE_RENDER_REQUEST,
        templateKey: 'unknown.v1',
        idempotencyKey: 'demo/unknown',
      }),
    })
    expect(response.status).toBe(403)
    const body = await response.json() as { code: string }
    expect(body.code).toBe(DOCUMENT_RENDERING_FAILURES.templateNotAllowed)
  })

  test('GET /v1/templates lists allowed templates', async () => {
    const response = await app.request('/v1/templates', {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { templates: Array<{ key: string }> }
    expect(body.templates.map(template => template.key)).toContain('report-card.v1')
    expect(body.templates.map(template => template.key)).toContain('logbook.v1')
  })

  test('GET /doc returns OpenAPI document', async () => {
    const response = await app.request('/doc')
    expect(response.status).toBe(200)
    const body = await response.json() as { openapi: string, paths: Record<string, unknown> }
    expect(body.openapi).toBe('3.0.0')
    expect(body.paths['/v1/render']).toBeDefined()
  })

  test('POST /v1/render storage delivery returns artifact', async () => {
    const objectStorage = createRecordingObjectStorage({
      downloadUrl: 'https://r2.example/contract',
      expiresAt: new Date('2030-06-01T00:00:00.000Z'),
    })
    const storageApp = createDocsApp({
      auth: { devToken: 'test-token' },
      objectStorage,
    })

    const response = await storageApp.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...EXAMPLE_RENDER_REQUEST,
        delivery: 'storage',
        idempotencyKey: `demo/report-card/storage-${crypto.randomUUID()}`,
      }),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as {
      artifact?: { objectId: string, downloadUrl: string, expiresAt: string }
      bytesBase64?: string
    }
    expect(body.bytesBase64).toBeUndefined()
    expect(body.artifact?.downloadUrl).toBe('https://r2.example/contract')
    expect(body.artifact?.objectId.startsWith('obj_')).toBe(true)
  })

  test('POST /v1/render returns xlsx bytes', async () => {
    const response = await app.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...EXAMPLE_RENDER_REQUEST,
        format: 'xlsx',
        idempotencyKey: `demo/report-card/xlsx-${crypto.randomUUID()}`,
      }),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { contentType: string, bytesBase64: string }
    expect(body.contentType).toContain('spreadsheetml')
    expect(body.bytesBase64.length).toBeGreaterThan(0)
  })

  test('POST /v1/render rate limit returns 429', async () => {
    const limitedApp = createDocsApp({
      auth: { devToken: 'test-token' },
      rateLimiter: {
        async limit() {
          return { success: false }
        },
      },
    })
    const response = await limitedApp.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...EXAMPLE_RENDER_REQUEST,
        idempotencyKey: `demo/report-card/rate-${crypto.randomUUID()}`,
      }),
    })
    expect(response.status).toBe(429)
    const body = await response.json() as { code: string }
    expect(body.code).toBe(DOCUMENT_RENDERING_FAILURES.rateLimited)
  })
})
