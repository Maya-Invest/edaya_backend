export type { BrowserRunBinding } from "./adapters/browser-run-pdf-renderer";
export { createBrowserRunPdfRenderer } from "./adapters/browser-run-pdf-renderer";
export { createChromePdfRenderer, detectChromeExecutable } from "./adapters/chrome-pdf-renderer";
export { createGotenbergPdfRenderer } from "./adapters/gotenberg-pdf-renderer";
export { createStubPdfRenderer } from "./adapters/stub-pdf-renderer";
export { createPdfRenderer } from "./adapters/create-pdf-renderer";
export { createDocumentRenderer } from "./document-renderer";
export type { CreateDocumentRendererOptions } from "./document-renderer";
export type { DocsRendererEnv } from "./env";
export { DocumentRenderError, isDocumentRenderError } from "./errors";
export type { PdfRenderer, PdfRenderInput } from "./ports/pdf-renderer";
export { resolvePdfRenderer } from "./resolve";
export type { ResolvedPdfRenderer, ResolvedPdfRendererKind } from "./resolve";
export { renderDocument } from "./services/render-document";
export type { RenderDocumentDependencies } from "./services/render-document";
export { getTemplateDefinition, listTemplateDefinitions, toCatalogEntry } from "./templates/registry";
export {
  DOCUMENT_RENDERING_FAILURES,
} from "./types";
export type {
  DocumentRenderingFailureCode,
  DocumentTemplateKey,
  PageOrientation,
  PaperSize,
  RenderDocumentRequest,
  RenderDocumentResult,
  RenderDocumentSuccess,
  RenderFormat,
  RenderOptions,
  SignaturePosition,
  SignatureSlot,
  TemplateCatalogEntry,
} from "./types";
