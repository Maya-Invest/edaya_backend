/**
 * Local logbook.v1 preview.
 *
 * Always writes HTML. PDF when Gotenberg is up:
 *   bun run gotenberg:up
 *   GOTENBERG_URL=http://localhost:3000 bun scripts/preview-logbook.ts
 *
 * HTML-only:
 *   bun scripts/preview-logbook.ts
 */
import { EXAMPLE_LOGBOOK_RENDER_REQUEST } from '../../package/document-rendering/src/testing/examples.ts'
import { getTemplateDefinition } from '../../package/document-rendering/src/templates/registry.ts'
import { createPdfRenderer, renderDocument } from '../../package/document-rendering/src/index.ts'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = join(import.meta.dir, '../..', 'tmp', 'pdfs')
mkdirSync(outDir, { recursive: true })

const template = getTemplateDefinition('logbook.v1')
if (!template) {
  console.error('logbook.v1 not registered')
  process.exit(1)
}

const html = template.compileHtml('fr', EXAMPLE_LOGBOOK_RENDER_REQUEST.payload)
const htmlPath = join(outDir, 'logbook.v1-local-preview.html')
writeFileSync(htmlPath, html)

const gotenbergUrl = process.env.GOTENBERG_URL
const result: { htmlPath: string, pdfPath?: string, byteLength?: number, gotenbergUrl?: string } = {
  htmlPath,
}

if (gotenbergUrl) {
  const rendered = await renderDocument({
    ...EXAMPLE_LOGBOOK_RENDER_REQUEST,
    idempotencyKey: `local/logbook-preview/${Date.now()}`,
  }, {
    pdfRenderer: createPdfRenderer(gotenbergUrl),
  })

  if (rendered.kind !== 'success') {
    console.error(rendered)
    process.exit(1)
  }

  const bytes = Buffer.from(rendered.value.bytesBase64!, 'base64')
  const pdfPath = join(outDir, 'logbook.v1-local-preview.pdf')
  writeFileSync(pdfPath, bytes)
  result.pdfPath = pdfPath
  result.byteLength = bytes.byteLength
  result.gotenbergUrl = gotenbergUrl
}

console.log(result)
