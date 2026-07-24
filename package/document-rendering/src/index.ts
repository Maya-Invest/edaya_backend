/// <reference path="./templates/asset-modules.d.ts" />
/// <reference path="./text-modules.d.ts" />

export { createBrowserRunPdfRenderer } from './adapters/browser-run-pdf-renderer.ts'
export type { BrowserRunBinding } from './adapters/browser-run-pdf-renderer.ts'
export { createObjectStorageFromEnv, createR2ObjectStorageFromEnv, isR2ObjectStorageConfigured } from './adapters/create-object-storage.ts'
export type { ConfiguredR2Environment, R2Environment } from './adapters/create-object-storage.ts'
export { createPdfRenderer } from './adapters/create-pdf-renderer.ts'
export { createExcelJsXlsxRenderer } from './adapters/exceljs-xlsx-renderer.ts'
export { createGotenbergPdfRenderer } from './adapters/gotenberg-pdf-renderer.ts'
export { createR2ObjectStorage, resolveR2Endpoint } from './adapters/r2-object-storage.ts'
export type { R2ObjectStorageConfig } from './adapters/r2-object-storage.ts'
export { createStubPdfRenderer } from './adapters/stub-pdf-renderer.ts'
export type {
  CreateDownloadUrlOptions,
  ObjectStorage,
  PresignedDownload,
  PutObjectInput,
  PutObjectResult,
} from './ports/object-storage.ts'
export type { PdfRenderer, PdfRenderInput } from './ports/pdf-renderer.ts'
export type { XlsxRenderer, XlsxRenderInput } from './ports/xlsx-renderer.ts'
export { buildDocsArtifactKey, createObjectId, fileNameForFormat } from './services/build-docs-artifact-key.ts'
export { overlaySignatures } from './services/overlay-signatures.ts'
export {
  authorizeRenderRequest,
  listAuthorizedTemplates,
  renderDocument,
} from './services/render-document.ts'
export type { RenderDocumentDependencies } from './services/render-document.ts'
export {
  getTemplateDefinition,
  listTemplateDefinitions,
  toCatalogEntry,
} from './templates/registry.ts'
