import type { HttpSeedClient } from './client'
import { executeCoreCommand } from './core-command'
import { commandMethodToPublicName, entityPublicName } from './names'

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

  if (value && typeof value === 'object' && 'data' in value && value.data && typeof value.data === 'object') {
    return serializePlainObject(value.data as Record<string, unknown>)
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
  if (entity && typeof entity === 'object' && 'sectionResults' in entity && 'data' in entity) {
    const reportCardResult = entity as {
      data: Record<string, unknown>
      sectionResults: readonly unknown[]
    }
    return {
      ...serializePlainObject(reportCardResult.data),
      sectionResults: reportCardResult.sectionResults.map(item => serializeValue(item)),
    }
  }

  if (entity && typeof entity === 'object' && 'data' in entity && entity.data && typeof entity.data === 'object') {
    return serializePlainObject(entity.data as Record<string, unknown>)
  }

  if (entity && typeof entity === 'object') {
    return serializePlainObject(entity as Record<string, unknown>)
  }

  throw new Error('Cannot serialize entity for HTTP core save')
}

export async function postCoreCommand(
  options: CoreHttpRequestOptions,
  methodName: string,
  payload: unknown,
): Promise<unknown> {
  const { body } = await executeCoreCommand<Record<string, unknown>>({
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    commandName: commandMethodToPublicName(methodName),
    requestId: options.requestId,
    payload: payload as Record<string, unknown>,
  })

  return body
}

export async function postEntityList(
  options: CoreHttpRequestOptions,
  serviceName: string,
  query: Record<string, unknown> = {},
): Promise<unknown[]> {
  const { response, body } = await options.client.jsonRequest<unknown[]>(
    `/core/entities/${entityPublicName(serviceName)}/list`,
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

  return body ?? []
}

export async function postEntityFindById(
  options: CoreHttpRequestOptions,
  serviceName: string,
  id: string,
): Promise<unknown | undefined> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${entityPublicName(serviceName)}/${encodeURIComponent(id)}`,
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

  return body ?? undefined
}

export async function postEntityFindOne(
  options: CoreHttpRequestOptions,
  serviceName: string,
  query: Record<string, unknown>,
): Promise<unknown | undefined> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${entityPublicName(serviceName)}/one`,
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

  return body ?? undefined
}

export async function postEntitySave(
  options: CoreHttpRequestOptions,
  serviceName: string,
  entity: unknown,
): Promise<void> {
  const { response, body } = await options.client.jsonRequest(
    `/core/entities/${entityPublicName(serviceName)}/save`,
    {
      method: 'POST',
      headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
      body: JSON.stringify(entityPayload(entity)),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`Entity save failed for ${serviceName}: ${response.status} ${message}`)
  }
}
