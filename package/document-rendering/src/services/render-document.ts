import type {
  DocumentRenderingFailureCode,
  RenderDocumentRequest,
  RenderDocumentResult,
  ServiceTokenClaims,
} from '@edaya/document-contracts'
import type { ObjectStorage } from '../ports/object-storage.ts'
import type { PdfRenderer } from '../ports/pdf-renderer.ts'
import type { XlsxRenderer } from '../ports/xlsx-renderer.ts'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { DOCUMENT_RENDERING_FAILURES } from '@edaya/document-contracts'
import { getTemplateDefinition, toCatalogEntry } from '../templates/registry.ts'
import { buildDocsArtifactKey, createObjectId, fileNameForFormat } from './build-docs-artifact-key.ts'
import { overlaySignatures } from './overlay-signatures.ts'

const idempotencyCache = new Map<string, RenderDocumentResult>()

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function createRenderId(): string {
  return `rnd_${randomUUID().replaceAll('-', '')}`
}

function contentTypeForFormat(format: RenderDocumentRequest['format']): string {
  return format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

export interface RenderDocumentDependencies {
  readonly pdfRenderer: PdfRenderer
  readonly xlsxRenderer?: XlsxRenderer | null
  readonly objectStorage?: ObjectStorage | null
  readonly fetchImpl?: typeof fetch
}

export function authorizeRenderRequest(
  request: RenderDocumentRequest,
  claims: ServiceTokenClaims,
): DocumentRenderingFailureCode | null {
  if (claims.schoolId !== request.schoolId)
    return DOCUMENT_RENDERING_FAILURES.forbidden
  if (!claims.allowedTemplates.includes(request.templateKey))
    return DOCUMENT_RENDERING_FAILURES.templateNotAllowed
  if (!claims.allowedFormats.includes(request.format))
    return DOCUMENT_RENDERING_FAILURES.forbidden
  return null
}

export async function renderDocument(
  request: RenderDocumentRequest,
  dependencies: RenderDocumentDependencies,
): Promise<RenderDocumentResult> {
  const cached = idempotencyCache.get(request.idempotencyKey)
  if (cached)
    return cached

  const template = getTemplateDefinition(request.templateKey)
  if (!template)
    return failure(DOCUMENT_RENDERING_FAILURES.templateNotFound, `Unknown template: ${request.templateKey}`)

  if (!template.formats.includes(request.format))
    return failure(DOCUMENT_RENDERING_FAILURES.invalidPayload, `Format ${request.format} is not supported for ${request.templateKey}`)

  const validationError = template.validatePayload(request.payload)
  if (validationError)
    return failure(DOCUMENT_RENDERING_FAILURES.invalidPayload, validationError)

  if (request.delivery === 'storage' && !dependencies.objectStorage) {
    return failure(
      DOCUMENT_RENDERING_FAILURES.unavailable,
      'delivery=storage requires object storage configuration',
    )
  }

  if (request.format === 'xlsx' && !dependencies.xlsxRenderer) {
    return failure(
      DOCUMENT_RENDERING_FAILURES.unavailable,
      'xlsx rendering is not configured',
    )
  }

  let bytes: Uint8Array
  try {
    if (request.format === 'pdf') {
      const html = template.compileHtml(request.locale, request.payload)
      bytes = await dependencies.pdfRenderer.render({
        html,
        paper: request.options?.paper ?? 'A4',
        orientation: request.options?.orientation ?? 'portrait',
      })
      const signatures = request.options?.signatures ?? []
      if (signatures.length > 0) {
        bytes = await overlaySignatures(bytes, signatures, {
          ...(dependencies.fetchImpl === undefined ? {} : { fetchImpl: dependencies.fetchImpl }),
        })
      }
    }
    else {
      bytes = await dependencies.xlsxRenderer!.render({
        templateKey: request.templateKey,
        locale: request.locale,
        payload: request.payload,
      })
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed'
    return failure(DOCUMENT_RENDERING_FAILURES.unavailable, message)
  }

  const renderId = createRenderId()
  const contentType = contentTypeForFormat(request.format)
  const sha256 = sha256Hex(bytes)

  if (request.delivery === 'storage') {
    const objectStorage = dependencies.objectStorage!
    const objectId = createObjectId()
    const fileName = fileNameForFormat(request.format, request.templateKey)
    const key = buildDocsArtifactKey({
      schoolId: request.schoolId,
      templateKey: request.templateKey,
      renderId,
      fileName,
    })

    try {
      await objectStorage.putObject({
        key,
        body: bytes,
        contentType,
        metadata: {
          schoolId: request.schoolId,
          templateKey: request.templateKey,
          renderId,
          objectId,
          sha256,
        },
      })
      const download = await objectStorage.getDownloadUrl(key, {
        fileName,
        disposition: 'attachment',
      })

      const result: RenderDocumentResult = {
        kind: 'success',
        value: {
          renderId,
          contentType,
          sha256,
          artifact: {
            objectId,
            downloadUrl: download.downloadUrl,
            expiresAt: download.expiresAt.toISOString(),
          },
        },
      }
      idempotencyCache.set(request.idempotencyKey, result)
      return result
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Storage upload failed'
      return failure(DOCUMENT_RENDERING_FAILURES.unavailable, message)
    }
  }

  const result: RenderDocumentResult = {
    kind: 'success',
    value: {
      renderId,
      contentType,
      sha256,
      bytesBase64: toBase64(bytes),
    },
  }

  idempotencyCache.set(request.idempotencyKey, result)
  return result
}

export function listAuthorizedTemplates(claims: ServiceTokenClaims) {
  return claims.allowedTemplates
    .map(key => getTemplateDefinition(key))
    .filter((template): template is NonNullable<typeof template> => template !== null)
    .map(toCatalogEntry)
}

function failure(code: DocumentRenderingFailureCode, message: string): RenderDocumentResult {
  return { kind: 'failure', code, message }
}
