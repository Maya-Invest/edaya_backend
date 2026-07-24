import type { RenderDocumentRequest, RenderOptions } from '@edaya/document-contracts'
import type { Context } from 'hono'
import type { DocsAppBindings } from '../composition.ts'
import type { RenderDocumentRequestBody } from '../openapi/schemas.ts'
import { Buffer } from 'node:buffer'
import { DOCUMENT_RENDERING_FAILURES } from '@edaya/document-contracts'
import {
  authorizeRenderRequest,
  listAuthorizedTemplates,
  renderDocument,
} from '@edaya/document-rendering'
import { enforceRateLimit } from '../middleware/rate-limit.ts'
import { logRenderEvent } from '../middleware/render-log.ts'

function failureStatus(code: string): 400 | 401 | 403 | 404 | 429 | 503 {
  switch (code) {
    case DOCUMENT_RENDERING_FAILURES.invalidToken:
      return 401
    case DOCUMENT_RENDERING_FAILURES.forbidden:
    case DOCUMENT_RENDERING_FAILURES.templateNotAllowed:
      return 403
    case DOCUMENT_RENDERING_FAILURES.templateNotFound:
      return 404
    case DOCUMENT_RENDERING_FAILURES.rateLimited:
      return 429
    case DOCUMENT_RENDERING_FAILURES.unavailable:
      return 503
    default:
      return 400
  }
}

function toRenderOptions(options: NonNullable<RenderDocumentRequestBody['options']>): RenderOptions {
  return {
    ...(options.paper !== undefined ? { paper: options.paper } : {}),
    ...(options.orientation !== undefined ? { orientation: options.orientation } : {}),
    ...(options.signatures !== undefined ? { signatures: options.signatures } : {}),
  }
}

function toRenderDocumentRequest(body: RenderDocumentRequestBody): RenderDocumentRequest {
  const request: RenderDocumentRequest = {
    templateKey: body.templateKey,
    format: body.format,
    locale: body.locale,
    schoolId: body.schoolId,
    payload: body.payload ?? {},
    delivery: body.delivery,
    idempotencyKey: body.idempotencyKey,
  }
  if (body.options !== undefined)
    return { ...request, options: toRenderOptions(body.options) }
  return request
}

function estimateByteSize(value: {
  bytesBase64?: string
  artifact?: unknown
}): number | undefined {
  if (typeof value.bytesBase64 === 'string')
    return Buffer.from(value.bytesBase64, 'base64').byteLength
  return undefined
}

export async function handleRender(
  context: Context<DocsAppBindings>,
  body: RenderDocumentRequestBody,
) {
  const startedAt = Date.now()
  const request = toRenderDocumentRequest(body)
  const claims = context.get('claims')
  const authorizationFailure = authorizeRenderRequest(request, claims)
  if (authorizationFailure) {
    logRenderEvent({
      event: 'docs.render',
      templateKey: request.templateKey,
      format: request.format,
      schoolId: request.schoolId,
      delivery: request.delivery,
      status: 'failure',
      durationMs: Date.now() - startedAt,
      errorCode: authorizationFailure,
    })
    return context.json({
      code: authorizationFailure,
      message: 'Render request is not allowed for this token',
    }, failureStatus(authorizationFailure))
  }

  const allowed = await enforceRateLimit(context.get('rateLimiter'), claims.schoolId)
  if (!allowed) {
    logRenderEvent({
      event: 'docs.render',
      templateKey: request.templateKey,
      format: request.format,
      schoolId: request.schoolId,
      delivery: request.delivery,
      status: 'failure',
      durationMs: Date.now() - startedAt,
      errorCode: DOCUMENT_RENDERING_FAILURES.rateLimited,
    })
    return context.json({
      code: DOCUMENT_RENDERING_FAILURES.rateLimited,
      message: 'Render rate limit exceeded',
    }, 429)
  }

  const result = await renderDocument(request, {
    pdfRenderer: context.get('pdfRenderer'),
    xlsxRenderer: context.get('xlsxRenderer'),
    objectStorage: context.get('objectStorage'),
  })
  if (result.kind === 'failure') {
    logRenderEvent({
      event: 'docs.render',
      templateKey: request.templateKey,
      format: request.format,
      schoolId: request.schoolId,
      delivery: request.delivery,
      status: 'failure',
      durationMs: Date.now() - startedAt,
      errorCode: result.code,
    })
    return context.json({
      code: result.code,
      message: result.message,
    }, failureStatus(result.code))
  }

  const byteSize = estimateByteSize(result.value)
  logRenderEvent({
    event: 'docs.render',
    templateKey: request.templateKey,
    format: request.format,
    schoolId: request.schoolId,
    delivery: request.delivery,
    status: 'success',
    durationMs: Date.now() - startedAt,
    renderId: result.value.renderId,
    ...(byteSize === undefined ? {} : { byteSize }),
  })

  return context.json(result.value)
}

export function handleTemplates(context: Context<DocsAppBindings>) {
  const claims = context.get('claims')
  return context.json({ templates: listAuthorizedTemplates(claims) })
}
