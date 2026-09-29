import type { JSONWebKeySet } from 'jose'
import type { DirectoryContact, DirectoryContactChannel, DirectoryLookupResult } from './claims'
import {
  IDENTITY_DIRECTORY_BY_CONTACT_PATH,
  IDENTITY_DIRECTORY_BY_ID_PREFIX,
  IDENTITY_DIRECTORY_SECRET_HEADER,
  IDENTITY_JWKS_PATH,
} from './claims'

export interface DirectoryClientOptions {
  baseUrl: string
  secret: string
  fetch?: typeof fetch
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString()
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Identity directory returned ${response.status}`)
  }
  return response.json()
}

export function createDirectoryClient(options: DirectoryClientOptions) {
  const send = options.fetch ?? fetch
  const headers = {
    [IDENTITY_DIRECTORY_SECRET_HEADER]: options.secret,
    accept: 'application/json',
  }

  return {
    async lookupByContact(channel: DirectoryContactChannel, value: string): Promise<DirectoryLookupResult | undefined> {
      const url = new URL(joinUrl(options.baseUrl, IDENTITY_DIRECTORY_BY_CONTACT_PATH))
      url.searchParams.set('channel', channel)
      url.searchParams.set('value', value)
      try {
        const response = await send(url.toString(), { method: 'GET', headers })
        if (!response.ok) {
          return undefined
        }
        const body = await readJson(response) as DirectoryLookupResult
        return { exists: Boolean(body.exists), ...(body.id ? { id: body.id } : {}) }
      }
      catch {
        return undefined
      }
    },

    async resolveBySubjectId(subjectId: string): Promise<DirectoryContact | undefined> {
      const url = joinUrl(options.baseUrl, `${IDENTITY_DIRECTORY_BY_ID_PREFIX}${encodeURIComponent(subjectId)}`)
      try {
        const response = await send(url, { method: 'GET', headers })
        if (!response.ok) {
          return undefined
        }
        const body = await readJson(response) as DirectoryContact
        const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : undefined
        const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : undefined
        if (!email && !phone && !body.identifiers?.length) {
          return undefined
        }
        return { ...(email ? { email } : {}), ...(phone ? { phone } : {}), identifiers: body.identifiers?.filter(i => (i.kind === 'email' || i.kind === 'phone') && typeof i.value === 'string') }
      }
      catch {
        return undefined
      }
    },

    async fetchJwks(): Promise<JSONWebKeySet> {
      const response = await send(joinUrl(options.baseUrl, IDENTITY_JWKS_PATH), { method: 'GET' })
      if (!response.ok) {
        throw new Error(`Failed to fetch identity JWKS (${response.status})`)
      }
      return await response.json() as JSONWebKeySet
    },
  }
}

export type DirectoryClient = ReturnType<typeof createDirectoryClient>
