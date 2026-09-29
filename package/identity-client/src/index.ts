import type { JSONWebKeySet } from 'jose'
import type { IdentityClaims } from './claims'
import { createDirectoryClient } from './directory'
import { verifyIdentityToken } from './verify'

export {
  ACCESS_TOKEN_TTL_SECONDS,
  type DirectoryContact,
  type DirectoryContactChannel,
  type DirectoryLookupResult,
  IDENTITY_DIRECTORY_BY_CONTACT_PATH,
  IDENTITY_DIRECTORY_BY_ID_PREFIX,
  IDENTITY_DIRECTORY_SECRET_HEADER,
  IDENTITY_JWKS_PATH,
  type IdentityClaims,
  IdentityTokenError,
} from './claims'
export { createDirectoryClient, type DirectoryClient, type DirectoryClientOptions } from './directory'
export { verifyIdentityToken, type VerifyIdentityTokenOptions } from './verify'

export interface IdentityClientOptions {
  issuer: string
  audience: string
  jwksUrl: string
  directoryBaseUrl: string
  directorySecret: string
  fetch?: typeof fetch
}

export function createIdentityClient(options: IdentityClientOptions) {
  const directory = createDirectoryClient({
    baseUrl: options.directoryBaseUrl,
    secret: options.directorySecret,
    fetch: options.fetch,
  })
  let cachedJwks: { value: JSONWebKeySet, expiresAt: number } | undefined

  async function loadJwks(): Promise<JSONWebKeySet> {
    const now = Date.now()
    if (cachedJwks && cachedJwks.expiresAt > now) {
      return cachedJwks.value
    }
    const send = options.fetch ?? fetch
    const response = await send(options.jwksUrl, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Failed to fetch identity JWKS (${response.status})`)
    }
    const value = await response.json() as JSONWebKeySet
    cachedJwks = { value, expiresAt: now + 60_000 }
    return value
  }

  return {
    directory,
    async verifyAccessToken(token: string): Promise<IdentityClaims> {
      return verifyIdentityToken(token, {
        issuer: options.issuer,
        audience: options.audience,
        jwks: await loadJwks(),
      })
    },
  }
}

export type IdentityClient = ReturnType<typeof createIdentityClient>
