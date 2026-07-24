import type { PdfRenderer } from '../ports/pdf-renderer.ts'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

async function createStubPdfBytes(paper: 'A4' | 'Letter', orientation: 'portrait' | 'landscape'): Promise<Uint8Array> {
  const portrait = paper === 'Letter' ? [612, 792] as const : [595.28, 841.89] as const
  const size = orientation === 'landscape'
    ? [portrait[1], portrait[0]] as const
    : portrait

  const doc = await PDFDocument.create()
  const page = doc.addPage([size[0], size[1]])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Edaya Docs stub PDF', {
    x: 48,
    y: size[1] - 64,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.1),
  })
  return doc.save()
}

/** Valid one-page PDF used when Gotenberg / Browser Run is unavailable. */
export function createStubPdfRenderer(): PdfRenderer {
  return {
    async render(input): Promise<Uint8Array> {
      return createStubPdfBytes(input.paper, input.orientation)
    },
  }
}
