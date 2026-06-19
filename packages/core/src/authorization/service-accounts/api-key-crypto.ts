import { createHash, randomBytes } from 'node:crypto'

export const API_KEY_PREFIX = 'sk_live_'

export interface GeneratedApiKey {
  readonly plaintext: string
  readonly prefix: string
  readonly hash: string
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString('base64url')
  return encodeApiKey(`${API_KEY_PREFIX}${secret}`)
}

export function encodeApiKey(plaintext: string): GeneratedApiKey {
  if (!plaintext.startsWith(API_KEY_PREFIX)) {
    throw new Error(`API key must start with "${API_KEY_PREFIX}"`)
  }

  const secret = plaintext.slice(API_KEY_PREFIX.length)
  if (secret.length < 16) {
    throw new Error('API key secret must be at least 16 characters')
  }

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
