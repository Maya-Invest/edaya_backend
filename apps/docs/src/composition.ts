import type { ServiceTokenClaims } from '@edaya/document-contracts'
import type {
  BrowserRunBinding,
  ObjectStorage,
  PdfRenderer,
  R2Environment,
  XlsxRenderer,
} from '@edaya/document-rendering'
import type { DocsAuthConfig } from './auth/service-token.ts'
import type { RateLimiter } from './middleware/rate-limit.ts'
import type { RenderDocumentRequestBody } from './openapi/schemas.ts'
import {
  createBrowserRunPdfRenderer,
  createExcelJsXlsxRenderer,
  createObjectStorageFromEnv,
  createPdfRenderer,
} from '@edaya/document-rendering'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createMiddleware } from 'hono/factory'
import { verifyServiceToken } from './auth/service-token.ts'
import {
  configureOpenAPI,
  healthRoute,
  renderRouteDefinition,
  templatesRouteDefinition,
} from './openapi/configure.ts'
import { handleRender, handleTemplates } from './routes/render.ts'

export interface DocsAppBindings {
  Variables: {
    claims: ServiceTokenClaims
    pdfRenderer: PdfRenderer
    xlsxRenderer: XlsxRenderer
    objectStorage: ObjectStorage | null
    rateLimiter: RateLimiter | undefined
  }
}

export interface CreateDocsAppOptions {
  readonly auth: DocsAuthConfig
  readonly gotenbergUrl?: string
  readonly browser?: BrowserRunBinding
  readonly pdfRenderer?: PdfRenderer
  readonly r2?: R2Environment
  readonly objectStorage?: ObjectStorage | null
  readonly xlsxRenderer?: XlsxRenderer
  readonly rateLimiter?: RateLimiter
}

function resolvePdfRenderer(options: CreateDocsAppOptions): PdfRenderer {
  if (options.pdfRenderer)
    return options.pdfRenderer
  if (options.browser)
    return createBrowserRunPdfRenderer(options.browser)
  return createPdfRenderer(options.gotenbergUrl)
}

export function createDocsApp(options: CreateDocsAppOptions) {
  const app = new OpenAPIHono<DocsAppBindings>({
    defaultHook: (result, context) => {
      if (result.success)
        return
      return context.json({
        code: 'document-rendering.invalid-payload',
        message: 'Invalid render request body',
      }, 400)
    },
  })
  const pdfRenderer = resolvePdfRenderer(options)
  const xlsxRenderer = options.xlsxRenderer ?? createExcelJsXlsxRenderer()
  const objectStorage = options.objectStorage !== undefined
    ? options.objectStorage
    : createObjectStorageFromEnv(options.r2 ?? {})
  const rateLimiter = options.rateLimiter

  const authMiddleware = createMiddleware<DocsAppBindings>(async (context, next) => {
    const verification = verifyServiceToken(context.req.header('Authorization'), options.auth)
    if (typeof verification === 'string') {
      return context.json({
        code: verification,
        message: 'Invalid or missing service token',
      }, 401)
    }
    context.set('claims', verification)
    context.set('pdfRenderer', pdfRenderer)
    context.set('xlsxRenderer', xlsxRenderer)
    context.set('objectStorage', objectStorage)
    context.set('rateLimiter', rateLimiter)
    return await next()
  })

  configureOpenAPI(app)

  app.openapi(healthRoute, context => context.json({ status: 'ok' as const }))

  app.use('/v1/*', authMiddleware)

  // Multi-status OpenAPI handlers are not practical to type-check against response unions.
  app.openapi(templatesRouteDefinition, context => handleTemplates(context) as never)
  app.openapi(renderRouteDefinition, async (context) => {
    const body = context.req.valid('json') as RenderDocumentRequestBody
    return await handleRender(context, body) as never
  })

  return app
}
