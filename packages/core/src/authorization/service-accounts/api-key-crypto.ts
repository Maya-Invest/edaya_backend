import { createHash, randomBytes } from 'node:crypto'

export const API_KEY_PREFIX = 'sk_live_'

export interface GeneratedApiKey {
  readonly plaintext: string
  readonly prefix: string
  readonly hash: string
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString('base64url')
  const plaintext = `${API_KEY_PREFIX}${secret}`
  const prefix = plaintext.slice(0, API_KEY_PREFIX.length + 8)
  return {
    plaintext,
    prefix,
    hash: hashApiKey(plaintext),
  }
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function parseBearerApiKey(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2)
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return undefined
  }

  const trimmed = token.trim()
  return trimmed || undefined
}
