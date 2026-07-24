/**
 * Local report-card PDF preview via Gotenberg (no Cloudflare deploy).
 *
 *   bun run gotenberg:up
 *   GOTENBERG_URL=http://localhost:3000 bun scripts/preview-report-card.ts
 */
import { EXAMPLE_RENDER_REQUEST } from '../../package/document-rendering/src/testing/examples.ts'
import { createPdfRenderer, renderDocument } from '../../package/document-rendering/src/index.ts'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const gotenbergUrl = process.env.GOTENBERG_URL ?? 'http://localhost:3000'
const outDir = join(import.meta.dir, '../..', 'tmp', 'pdfs')
mkdirSync(outDir, { recursive: true })

const photoPath = process.env.PHOTO_DATA_URI_FILE ?? '/tmp/edaya-docs-demo-assets/photo.datauri.txt'
let photoUrl: string | undefined
try {
  photoUrl = readFileSync(photoPath, 'utf8').trim()
}
catch {
  photoUrl = undefined
}

const request = {
  ...EXAMPLE_RENDER_REQUEST,
  idempotencyKey: `local/preview/${Date.now()}`,
  payload: {
    ...EXAMPLE_RENDER_REQUEST.payload,
    ...(photoUrl ? { photoUrl } : {}),
  },
}

const result = await renderDocument(request, {
  pdfRenderer: createPdfRenderer(gotenbergUrl),
})

if (result.kind !== 'success') {
  console.error(result)
  process.exit(1)
}

const bytes = Buffer.from(result.value.bytesBase64!, 'base64')
const pdfPath = join(outDir, 'report-card.v1-local-preview.pdf')
writeFileSync(pdfPath, bytes)
console.log({
  pdfPath,
  byteLength: bytes.byteLength,
  hasPhoto: Boolean(photoUrl),
  gotenbergUrl,
})
