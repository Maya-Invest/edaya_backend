export const DOCUMENT_RENDERING_FAILURES = {
  closed: 'document-rendering.closed',
  forbidden: 'document-rendering.forbidden',
  invalidPayload: 'document-rendering.invalid-payload',
  invalidToken: 'document-rendering.invalid-token',
  rateLimited: 'document-rendering.rate-limited',
  templateNotFound: 'document-rendering.template-not-found',
  templateNotAllowed: 'document-rendering.template-not-allowed',
  unavailable: 'document-rendering.unavailable',
} as const

export type DocumentRenderingFailureCode
  = typeof DOCUMENT_RENDERING_FAILURES[keyof typeof DOCUMENT_RENDERING_FAILURES]

export type RenderFormat = 'pdf' | 'xlsx'
export type RenderDelivery = 'inline' | 'storage'
export type PaperSize = 'A4' | 'Letter'
export type PageOrientation = 'portrait' | 'landscape'

export interface SignaturePosition {
  readonly page: 'first' | 'last' | number
  readonly x: number
  readonly y: number
  readonly width: number
}

export interface SignatureSlot {
  readonly slot: string
  readonly imageUrl: string
  readonly position: SignaturePosition
}

export interface RenderOptions {
  readonly paper?: PaperSize
  readonly orientation?: PageOrientation
  readonly signatures?: readonly SignatureSlot[]
}

export interface RenderDocumentRequest {
  readonly templateKey: string
  readonly format: RenderFormat
  readonly locale: string
  readonly schoolId: string
  readonly payload: unknown
  readonly options?: RenderOptions
  readonly delivery: RenderDelivery
  readonly idempotencyKey: string
}

export interface RenderArtifact {
  readonly objectId: string
  readonly downloadUrl: string
  readonly expiresAt: string
}

export interface RenderDocumentResponse {
  readonly renderId: string
  readonly contentType: string
  readonly sha256: string
  readonly bytesBase64?: string
  readonly artifact?: RenderArtifact
}

export interface TemplateCatalogEntry {
  readonly key: string
  readonly formats: readonly RenderFormat[]
  readonly locales: readonly string[]
  readonly version: string
}

export interface TemplateCatalogResponse {
  readonly templates: readonly TemplateCatalogEntry[]
}

export interface ServiceTokenClaims {
  readonly issuer: string
  readonly subject: string
  readonly schoolId: string
  readonly allowedTemplates: readonly string[]
  readonly allowedFormats: readonly RenderFormat[]
  readonly expiresAt: number
}

export type RenderDocumentResult
  = | { readonly kind: 'success', readonly value: RenderDocumentResponse }
    | { readonly kind: 'failure', readonly code: DocumentRenderingFailureCode, readonly message: string }

export function isDocumentRenderingFailureCode(value: string): value is DocumentRenderingFailureCode {
  return Object.values(DOCUMENT_RENDERING_FAILURES).includes(value as DocumentRenderingFailureCode)
}
