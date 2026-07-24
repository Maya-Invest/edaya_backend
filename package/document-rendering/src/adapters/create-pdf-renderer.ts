import type { PdfRenderer } from '../ports/pdf-renderer.ts'
import { createGotenbergPdfRenderer } from './gotenberg-pdf-renderer.ts'
import { createStubPdfRenderer } from './stub-pdf-renderer.ts'

export function createPdfRenderer(gotenbergUrl?: string): PdfRenderer {
  if (gotenbergUrl && gotenbergUrl.length > 0)
    return createGotenbergPdfRenderer(gotenbergUrl)
  return createStubPdfRenderer()
}
