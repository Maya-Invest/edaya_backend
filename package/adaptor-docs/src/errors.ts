import type { DocumentRenderingFailureCode } from "./types";

export class DocumentRenderError extends Error {
  readonly code: DocumentRenderingFailureCode;

  constructor(code: DocumentRenderingFailureCode, message: string) {
    super(message);
    this.name = "DocumentRenderError";
    this.code = code;
  }
}

export function isDocumentRenderError(error: unknown): error is DocumentRenderError {
  return error instanceof DocumentRenderError;
}
