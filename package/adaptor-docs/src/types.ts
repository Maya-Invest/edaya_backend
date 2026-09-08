export type DocumentTemplateKey = "report-card.v1" | "logbook.v1";
export type RenderFormat = "pdf";
export type PaperSize = "A4" | "Letter";
export type PageOrientation = "portrait" | "landscape";

export const DOCUMENT_RENDERING_FAILURES = {
  invalidPayload: "document-rendering.invalid-payload",
  templateNotFound: "document-rendering.template-not-found",
  unavailable: "document-rendering.unavailable",
} as const;

export type DocumentRenderingFailureCode
  = typeof DOCUMENT_RENDERING_FAILURES[keyof typeof DOCUMENT_RENDERING_FAILURES];

export interface SignaturePosition {
  readonly page: "first" | "last" | number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface SignatureSlot {
  readonly slot: string;
  readonly imageUrl: string;
  readonly position: SignaturePosition;
}

export interface RenderOptions {
  readonly paper?: PaperSize;
  readonly orientation?: PageOrientation;
  readonly signatures?: readonly SignatureSlot[];
}

export interface RenderDocumentRequest {
  readonly templateKey: string;
  readonly locale: string;
  readonly payload: unknown;
  readonly options?: RenderOptions;
}

export interface RenderDocumentSuccess {
  readonly renderId: string;
  readonly contentType: string;
  readonly sha256: string;
  readonly bytes: Uint8Array;
}

export type RenderDocumentResult
  = | { readonly kind: "success"; readonly value: RenderDocumentSuccess }
    | { readonly kind: "failure"; readonly code: DocumentRenderingFailureCode; readonly message: string };

export interface TemplateCatalogEntry {
  readonly key: string;
  readonly formats: readonly RenderFormat[];
  readonly locales: readonly string[];
  readonly version: string;
}
