import { Buffer } from 'node:buffer'
import { DOCUMENT_RENDERING_FAILURES } from '@edaya/document-contracts'
import { describe, expect, test } from 'bun:test'
import { createExcelJsXlsxRenderer } from '../adapters/exceljs-xlsx-renderer.ts'
import { createStubPdfRenderer } from '../adapters/stub-pdf-renderer.ts'
import { getTemplateDefinition } from '../templates/registry.ts'
import { EXAMPLE_LOGBOOK_RENDER_REQUEST, EXAMPLE_RENDER_REQUEST } from '../testing/examples.ts'
import { INVALID_PAYLOAD_REQUEST } from '../testing/fixtures.ts'
import { createRecordingPdfRenderer } from '../testing/recording-renderer.ts'
import { createRecordingObjectStorage } from '../testing/recording-storage.ts'
import { renderDocument } from './render-document.ts'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

describe('renderDocument', () => {
  test('renders inline PDF with stable idempotency', async () => {
    const pdfRenderer = createRecordingPdfRenderer(new TextEncoder().encode('%PDF-stub'))
    const request = {
      ...EXAMPLE_RENDER_REQUEST,
      idempotencyKey: `demo/report-card/unit-${crypto.randomUUID()}`,
    }
    const first = await renderDocument(request, { pdfRenderer })
    const second = await renderDocument(request, { pdfRenderer })

    expect(first.kind).toBe('success')
    expect(second.kind).toBe('success')
    if (first.kind === 'success' && second.kind === 'success') {
      expect(first.value.renderId).toBe(second.value.renderId)
      expect(first.value.sha256).toBe(second.value.sha256)
    }
    expect(pdfRenderer.calls).toHaveLength(1)
    expect(pdfRenderer.calls[0]?.html).toContain('YAO Curie Marie Christelle Ahou')
    expect(pdfRenderer.calls[0]?.html).toContain('Français')
    expect(pdfRenderer.calls[0]?.html).toContain('10,75 / 20')
  })

  test('rejects invalid payload', async () => {
    const pdfRenderer = createRecordingPdfRenderer(new Uint8Array())
    const result = await renderDocument(INVALID_PAYLOAD_REQUEST, { pdfRenderer })
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe(DOCUMENT_RENDERING_FAILURES.invalidPayload)
      expect(result.message).toContain('studentName')
    }
  })

  test('compiles report-card.v1 HTML from template assets', () => {
    const template = getTemplateDefinition('report-card.v1')
    expect(template).not.toBeNull()
    const html = template!.compileHtml('fr', EXAMPLE_RENDER_REQUEST.payload)
    expect(html).toContain('LYCEE MAMIE ADJOUA')
    expect(html).toContain('BULLETIN TRIMESTRIEL DE NOTES')
    expect(html).toContain('Mathématiques')
    expect(html).toContain('BILAN LETTRES')
    expect(html).toContain('--brand: #1f4b7a')
  })

  test('compiles logbook.v1 HTML from template assets', () => {
    const template = getTemplateDefinition('logbook.v1')
    expect(template).not.toBeNull()
    const html = template!.compileHtml('fr', EXAMPLE_LOGBOOK_RENDER_REQUEST.payload)
    expect(html).toContain('Collège Edaya Cocody')
    expect(html).toContain('6ème A')
    expect(html).toContain('Mathématiques')
    expect(html).toContain('Nombres entiers')
    expect(html).toContain('Français')
    expect(html).toContain('--brand: #1f4b7a')
  })

  test('stores PDF artifact when delivery=storage', async () => {
    const pdfRenderer = createRecordingPdfRenderer(new TextEncoder().encode('%PDF-storage'))
    const objectStorage = createRecordingObjectStorage({
      downloadUrl: 'https://r2.example/presigned',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })
    const result = await renderDocument({
      ...EXAMPLE_RENDER_REQUEST,
      delivery: 'storage',
      idempotencyKey: `demo/report-card/storage-${crypto.randomUUID()}`,
    }, { pdfRenderer, objectStorage })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.bytesBase64).toBeUndefined()
      expect(result.value.artifact?.downloadUrl).toBe('https://r2.example/presigned')
      expect(result.value.artifact?.objectId.startsWith('obj_')).toBe(true)
      expect(result.value.artifact?.expiresAt).toBe('2030-01-01T00:00:00.000Z')
    }
    expect(objectStorage.puts).toHaveLength(1)
    expect(objectStorage.puts[0]?.key).toContain('sch_demo/docs/report-card.v1/')
    expect(objectStorage.puts[0]?.key).toEndWith('report-card-v1.pdf')
    expect(objectStorage.downloads).toHaveLength(1)
  })

  test('rejects delivery=storage without object storage', async () => {
    const pdfRenderer = createRecordingPdfRenderer(new TextEncoder().encode('%PDF-stub'))
    const result = await renderDocument({
      ...EXAMPLE_RENDER_REQUEST,
      delivery: 'storage',
      idempotencyKey: `demo/report-card/no-storage-${crypto.randomUUID()}`,
    }, { pdfRenderer })

    expect(result).toEqual({
      kind: 'failure',
      code: DOCUMENT_RENDERING_FAILURES.unavailable,
      message: 'delivery=storage requires object storage configuration',
    })
  })

  test('overlays signature images onto PDF', async () => {
    const pdfRenderer = createStubPdfRenderer()
    const result = await renderDocument({
      ...EXAMPLE_RENDER_REQUEST,
      options: {
        signatures: [{
          slot: 'principal',
          imageUrl: 'https://signatures.example/principal.png',
          position: { page: 'last', x: 400, y: 80, width: 120 },
        }],
      },
      idempotencyKey: `demo/report-card/signature-${crypto.randomUUID()}`,
    }, {
      pdfRenderer,
      fetchImpl: (async () => new Response(TINY_PNG, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })) as unknown as typeof fetch,
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.contentType).toBe('application/pdf')
      expect(result.value.bytesBase64!.length).toBeGreaterThan(100)
      const bytes = Buffer.from(result.value.bytesBase64!, 'base64')
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    }
  })

  test('renders report-card.v1 as xlsx', async () => {
    const result = await renderDocument({
      ...EXAMPLE_RENDER_REQUEST,
      format: 'xlsx',
      idempotencyKey: `demo/report-card/xlsx-${crypto.randomUUID()}`,
    }, {
      pdfRenderer: createRecordingPdfRenderer(new Uint8Array()),
      xlsxRenderer: createExcelJsXlsxRenderer(),
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.contentType).toContain('spreadsheetml')
      const bytes = Buffer.from(result.value.bytesBase64!, 'base64')
      // ZIP/XLSX magic
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4B)
    }
  })
})
