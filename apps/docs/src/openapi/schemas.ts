import { z } from '@hono/zod-openapi'

export const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
}).openapi('ErrorBody')

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
}).openapi('HealthResponse')

export const SignaturePositionSchema = z.object({
  page: z.union([z.literal('first'), z.literal('last'), z.number().int()]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
}).openapi('SignaturePosition')

export const SignatureSlotSchema = z.object({
  slot: z.string(),
  imageUrl: z.string(),
  position: SignaturePositionSchema,
}).openapi('SignatureSlot')

export const RenderOptionsSchema = z.object({
  paper: z.enum(['A4', 'Letter']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  signatures: z.array(SignatureSlotSchema).optional(),
}).openapi('RenderOptions')

export const RenderDocumentRequestSchema = z.object({
  templateKey: z.string().min(1),
  format: z.enum(['pdf', 'xlsx']),
  locale: z.string().min(1),
  schoolId: z.string().min(1),
  payload: z.unknown(),
  options: RenderOptionsSchema.optional(),
  delivery: z.enum(['inline', 'storage']),
  idempotencyKey: z.string().min(1),
}).openapi('RenderDocumentRequest')

export const RenderArtifactSchema = z.object({
  objectId: z.string(),
  downloadUrl: z.string(),
  expiresAt: z.string(),
}).openapi('RenderArtifact')

export const RenderDocumentResponseSchema = z.object({
  renderId: z.string(),
  contentType: z.string(),
  sha256: z.string(),
  bytesBase64: z.string().optional(),
  artifact: RenderArtifactSchema.optional(),
}).openapi('RenderDocumentResponse')

export const TemplateCatalogEntrySchema = z.object({
  key: z.string(),
  formats: z.array(z.enum(['pdf', 'xlsx'])),
  locales: z.array(z.string()),
  version: z.string(),
}).openapi('TemplateCatalogEntry')

export const TemplateCatalogResponseSchema = z.object({
  templates: z.array(TemplateCatalogEntrySchema),
}).openapi('TemplateCatalogResponse')

export type RenderDocumentRequestBody = z.infer<typeof RenderDocumentRequestSchema>
