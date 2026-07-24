import type { PdfRenderer, PdfRenderInput } from '../ports/pdf-renderer.ts'

export interface RecordingPdfRenderer extends PdfRenderer {
  readonly calls: PdfRenderInput[]
}

export function createRecordingPdfRenderer(bytes: Uint8Array): RecordingPdfRenderer {
  const calls: PdfRenderInput[] = []
  return {
    calls,
    async render(input: PdfRenderInput) {
      calls.push(input)
      return bytes
    },
  }
}
