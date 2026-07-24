import type { RenderFormat, ServiceTokenClaims } from '@edaya/document-contracts'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { DOCUMENT_RENDERING_FAILURES } from '@edaya/document-contracts'

export interface DocsAuthConfig {
  readonly devToken?: string
  readonly jwtSecret?: string
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, 'base64').toString('utf8')
}

function signJwtSegment(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

interface JwtPayload {
  iss?: unknown
  sub?: unknown
  schoolId?: unknown
  exp?: unknown
  allowedTemplates?: unknown
  allowedFormats?: unknown
}

function parseJwtClaims(token: string, secret: string): ServiceTokenClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3)
    return null

  const [headerPart, payloadPart, signaturePart] = parts
  if (!headerPart || !payloadPart || !signaturePart)
    return null

  const data = `${headerPart}.${payloadPart}`
  const expected = signJwtSegment(data, secret)
  const actual = Buffer.from(signaturePart)
  const expectedBuffer = Buffer.from(expected)
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer))
    return null

  const payload = JSON.parse(decodeBase64Url(payloadPart)) as JwtPayload
  const expiresAt = typeof payload.exp === 'number' ? payload.exp : 0
  if (expiresAt * 1000 <= Date.now())
    return null

  const allowedTemplates = Array.isArray(payload.allowedTemplates)
    ? payload.allowedTemplates.filter((value): value is string => typeof value === 'string')
    : []
  const allowedFormats = Array.isArray(payload.allowedFormats)
    ? payload.allowedFormats.filter((value): value is RenderFormat => value === 'pdf' || value === 'xlsx')
    : []

  if (
    typeof payload.iss !== 'string'
    || typeof payload.sub !== 'string'
    || typeof payload.schoolId !== 'string'
    || allowedTemplates.length === 0
    || allowedFormats.length === 0
  ) {
    return null
  }

  return {
    issuer: payload.iss,
    subject: payload.sub,
    schoolId: payload.schoolId,
    allowedTemplates,
    allowedFormats,
    expiresAt,
  }
}

export function createDevServiceClaims(schoolId = 'sch_demo'): ServiceTokenClaims {
  return {
    issuer: 'edaya-docs-dev',
    subject: 'service:document-renderer',
    schoolId,
    allowedTemplates: ['report-card.v1', 'logbook.v1'],
    allowedFormats: ['pdf', 'xlsx'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }
}

export function verifyServiceToken(
  authorizationHeader: string | undefined,
  config: DocsAuthConfig,
): ServiceTokenClaims | typeof DOCUMENT_RENDERING_FAILURES.invalidToken {
  if (!authorizationHeader?.startsWith('Bearer '))
    return DOCUMENT_RENDERING_FAILURES.invalidToken

  const token = authorizationHeader.slice('Bearer '.length).trim()
  if (!token)
    return DOCUMENT_RENDERING_FAILURES.invalidToken

  if (config.devToken && token === config.devToken)
    return createDevServiceClaims()

  if (config.jwtSecret) {
    const claims = parseJwtClaims(token, config.jwtSecret)
    if (claims)
      return claims
  }

  return DOCUMENT_RENDERING_FAILURES.invalidToken
}
