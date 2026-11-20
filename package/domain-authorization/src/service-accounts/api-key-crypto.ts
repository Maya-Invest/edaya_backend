import { createHash, randomBytes } from 'node:crypto'

export const API_KEY_PREFIX = 'sk_live_'
export const S2S_API_KEY_PREFIX = 's2s_live_'

export interface GeneratedApiKey {
  readonly plaintext: string
  readonly prefix: string
  readonly hash: string
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function encodePrefixedApiKey(plaintext: string, keyPrefix: string): GeneratedApiKey {
  if (!plaintext.startsWith(keyPrefix)) {
    throw new Error(`API key must start with "${keyPrefix}"`)
  }

  const secret = plaintext.slice(keyPrefix.length)
  if (secret.length < 16) {
    throw new Error('API key secret must be at least 16 characters')
  }

  return {
    plaintext,
    prefix: plaintext.slice(0, keyPrefix.length + 8),
    hash: hashApiKey(plaintext),
  }
}

export function generatePrefixedApiKey(keyPrefix: string): GeneratedApiKey {
  const secret = randomBytes(32).toString('base64url')
  return encodePrefixedApiKey(`${keyPrefix}${secret}`, keyPrefix)
}

function parseBearerPrefixedApiKey(authorizationHeader: string | undefined, keyPrefix: string): string | undefined {
  if (!authorizationHeader) {
    return undefined
  }

  const escaped = keyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^Bearer (${escaped}[\\w-]{16,})$`, 'i').exec(authorizationHeader)?.[1]
}

export function generateApiKey(): GeneratedApiKey {
  return generatePrefixedApiKey(API_KEY_PREFIX)
}

export function encodeApiKey(plaintext: string): GeneratedApiKey {
  return encodePrefixedApiKey(plaintext, API_KEY_PREFIX)
}

export function parseBearerApiKey(authorizationHeader: string | undefined): string | undefined {
  return parseBearerPrefixedApiKey(authorizationHeader, API_KEY_PREFIX)
}

export function generateS2sApiKey(): GeneratedApiKey {
  return generatePrefixedApiKey(S2S_API_KEY_PREFIX)
}

export function encodeS2sApiKey(plaintext: string): GeneratedApiKey {
  return encodePrefixedApiKey(plaintext, S2S_API_KEY_PREFIX)
}

export function parseBearerS2sKey(authorizationHeader: string | undefined): string | undefined {
  return parseBearerPrefixedApiKey(authorizationHeader, S2S_API_KEY_PREFIX)
}
