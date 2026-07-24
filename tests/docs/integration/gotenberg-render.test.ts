import { Buffer } from 'node:buffer'
import { describe, expect, test } from 'bun:test'
import { createDocsApp } from '../../../apps/docs/src/composition.ts'
import { EXAMPLE_RENDER_REQUEST } from '../../../package/document-rendering/src/testing/examples.ts'

// eslint-disable-next-line dot-notation -- process.env index signature requires bracket access under TS4111
const gotenbergUrl = process.env['GOTENBERG_URL']?.trim()

describe.skipIf(!gotenbergUrl)('Gotenberg HTML→PDF integration', () => {
  const app = createDocsApp({
    auth: { devToken: 'test-token' },
    gotenbergUrl: gotenbergUrl!,
  })

  test('POST /v1/render returns a Chromium-rendered PDF for report-card.v1', async () => {
    const response = await app.request('/v1/render', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...EXAMPLE_RENDER_REQUEST,
        idempotencyKey: 'integration/gotenberg/report-card/1',
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json() as {
      contentType: string
      bytesBase64: string
    }
    expect(body.contentType).toBe('application/pdf')
    expect(body.bytesBase64.length).toBeGreaterThan(0)

    const bytes = Buffer.from(body.bytesBase64, 'base64')
    expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    // Stub PDFs are ~1KB; Chromium output for report-card.v1 is substantially larger.
    expect(bytes.byteLength).toBeGreaterThan(2_000)
  }, 30_000)
})
