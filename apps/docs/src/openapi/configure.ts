import type { OpenAPIHono } from '@hono/zod-openapi'
import type { DocsAppBindings } from '../composition.ts'
import { createRoute } from '@hono/zod-openapi'
import {
  ErrorBodySchema,
  HealthResponseSchema,
  RenderDocumentRequestSchema,
  RenderDocumentResponseSchema,
  TemplateCatalogResponseSchema,
} from './schemas.ts'

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
  },
})

export const templatesRouteDefinition = createRoute({
  method: 'get',
  path: '/v1/templates',
  tags: ['Templates'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Templates visible to the caller token allowlist',
      content: { 'application/json': { schema: TemplateCatalogResponseSchema } },
    },
    401: {
      description: 'Invalid or missing service token',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
  },
})

export const renderRouteDefinition = createRoute({
  method: 'post',
  path: '/v1/render',
  tags: ['Render'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: RenderDocumentRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Render completed',
      content: { 'application/json': { schema: RenderDocumentResponseSchema } },
    },
    400: {
      description: 'Invalid payload',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    401: {
      description: 'Invalid or missing service token',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    403: {
      description: 'Template or format not allowed',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    404: {
      description: 'Template not found',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
    503: {
      description: 'Renderer unavailable',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
  },
})

export function configureOpenAPI(app: OpenAPIHono<DocsAppBindings>) {
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Service token (dev static bearer or HS256 JWT)',
  })

  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      title: 'Edaya Docs API',
      version: '0.1.0',
      description: 'Stateless document rendering service for school platforms.',
    },
  })
}
