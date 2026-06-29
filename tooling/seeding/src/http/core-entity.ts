import type { SeedCommandKey, SeedEntityKey } from './catalog'
import type { HttpSeedClient } from './client'
import { unwrapEntity, unwrapEntityList } from '@edaya/api-client'
import { seedCommandPublicName, seedEntityPublicName } from './catalog'
import { executeCoreCommand } from './core-command'

export interface CoreHttpRequestOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
  requestId?: string
}

function coreHeaders(serviceAccountApiKey: string | undefined, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(serviceAccountApiKey ? { authorization: `Bearer ${serviceAccountApiKey}` } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }

  if (value && typeof value === 'object') {
    return serializePlainObject(value as Record<string, unknown>)
  }

  return value
}

function serializePlainObject(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    result[key] = serializeValue(entry)
  }
  return result
}

function entityPayload(entity: unknown): Record<string, unknown> {
  if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
    throw new Error('Cannot serialize entity for HTTP core save')
  }

  return serializePlainObject(entity as Record<string, unknown>)
}

export async function postCoreCommand(
  options: CoreHttpRequestOptions,
  methodName: SeedCommandKey,
  payload: unknown,
): Promise<unknown> {
  const serializedPayload = payload && typeof payload === 'object'
    ? serializePlainObject(payload as Record<string, unknown>)
    : payload

  const { response, body } = await executeCoreCommand<Record<string, unknown>>({
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    commandName: seedCommandPublicName(methodName),
    requestId: options.requestId,
    payload: serializedPayload as Record<string, unknown>,
  })

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : typeof body === 'object' && body
        ? JSON.stringify(body)
        : `HTTP ${response.status}`
    throw new Error(`Core command failed for ${methodName}: ${response.status} ${message}`)
  }

  return body
}

export async function postEntityList(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown> = {},
): Promise<unknown[]> {
  const { response, body } = await options.client.jsonRequest<unknown[]>(
    `/core/entities/${seedEntityPublicName(serviceName)}/list`,
    {
      method: 'POST',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
      body: JSON.stringify(query),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`Entity list failed for ${serviceName}: ${response.status} ${message}`)
  }

  return unwrapEntityList(body)
}

export async function postEntityCount(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown> = {},
): Promise<number> {
  const { response, body } = await options.client.jsonRequest<{ count?: number }>(
    `/core/entities/${seedEntityPublicName(serviceName)}/count`,
    {
      method: 'POST',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
      body: JSON.stringify(query),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`Entity count failed for ${serviceName}: ${response.status} ${message}`)
  }

  return typeof body?.count === 'number' ? body.count : 0
}

export async function postEntityFindById(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  id: string,
): Promise<unknown | undefined> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${seedEntityPublicName(serviceName)}/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`Entity get failed for ${serviceName}/${id}: ${response.status}`)
  }

  return body === undefined ? undefined : unwrapEntity(body)
}

export async function postEntityFindOne(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown>,
): Promise<unknown | undefined> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${seedEntityPublicName(serviceName)}/one`,
    {
      method: 'POST',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
      body: JSON.stringify(query),
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`Entity one failed for ${serviceName}: ${response.status}`)
  }

  return body === undefined ? undefined : unwrapEntity(body)
}

export async function postEntitySave(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  entity: unknown,
): Promise<void> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${seedEntityPublicName(serviceName)}/save`,
    {
      method: 'POST',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
      body: JSON.stringify(entityPayload(entity)),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : typeof body === 'object' && body
        ? JSON.stringify(body)
        : `HTTP ${response.status}`
    throw new Error(`Entity save failed for ${serviceName}: ${response.status} ${message}`)
  }
}
