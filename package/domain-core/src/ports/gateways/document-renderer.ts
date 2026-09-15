import type { DocumentTemplateKey } from '../../domain/documents/document-template-key'

export type { DocumentTemplateKey }
export type DocumentLocale = 'fr' | 'en'
export type DocumentPaperSize = 'A4' | 'Letter'
export type DocumentPageOrientation = 'portrait' | 'landscape'

export interface DocumentSignaturePosition {
  page: 'first' | 'last' | number
  x: number
  y: number
  width: number
}

export interface DocumentSignatureSlot {
  slot: string
  imageBytes: Uint8Array
  position: DocumentSignaturePosition
}

export interface DocumentRenderOptions {
  paper?: DocumentPaperSize
  orientation?: DocumentPageOrientation
  signatures?: readonly DocumentSignatureSlot[]
}

export interface DocumentRenderInput {
  templateKey: DocumentTemplateKey
  locale: DocumentLocale
  payload: unknown
  options?: DocumentRenderOptions
}

export interface DocumentRenderResult {
  bytes: Uint8Array
  contentType: string
  sha256: string
  renderId: string
}

export interface DocumentRendererPort {
  render: (input: DocumentRenderInput) => Promise<DocumentRenderResult>
}
