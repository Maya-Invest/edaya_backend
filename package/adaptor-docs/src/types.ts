export type DocumentTemplateKey
  = | "report-card.v1"
    | "annual-report-card.v1"
    | "logbook.v1"
    | "schooling-certificate.v1"
    | "enrollment-record.v1"
    | "student-id-card.v1"
    | "invoice.v1"
    | "receipt.v1"
    | "settlement-quittance.v1"
    | "account-statement.v1"
    | "payment-reminder.v1"
    | "withdrawal-certificate.v1"
    | "annual-transcript.v1"
    | "convocation.v1"
    | "class-timetable.v1"
    | "teacher-timetable.v1"
    | "class-roster.v1"
    | "attendance-sheet.v1"
    | "incident-report.v1";
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
  readonly imageBytes: Uint8Array;
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
