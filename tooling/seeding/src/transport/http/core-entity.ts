import type { SeedCommandKey, SeedEntityKey, SeedQueryKey } from './catalog'
import type { HttpSeedClient } from './client'
import { ApiError } from '@maya-invest/edaya-api-client'
import { createSeedSchoolClient } from './school-client'

export interface CoreHttpRequestOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
  requestId?: string
  actor?: { schoolId: string, actorId: string, academicYearId: string }
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

function schoolClient(options: CoreHttpRequestOptions) {
  return createSeedSchoolClient(options.client, {
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: options.requestId,
    actor: options.actor,
  })
}

function formatCoreError(scope: string, error: unknown): Error {
  if (error instanceof ApiError) {
    const body = error.body
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : typeof body === 'object' && body
        ? JSON.stringify(body)
        : `HTTP ${error.status}`
    return new Error(`${scope}: ${error.status} ${message}`)
  }

  return error instanceof Error ? error : new Error(String(error))
}

export async function postCoreCommand(
  options: CoreHttpRequestOptions,
  methodName: SeedCommandKey,
  payload: unknown,
): Promise<unknown> {
  const serializedPayload = payload && typeof payload === 'object'
    ? serializePlainObject(payload as Record<string, unknown>)
    : payload

  try {
    return await schoolClient(options).commands[methodName](serializedPayload)
  }
  catch (error) {
    throw formatCoreError(`Core command failed for ${methodName}`, error)
  }
}

export async function postCoreQuery(
  options: CoreHttpRequestOptions,
  methodName: SeedQueryKey,
  payload: unknown,
): Promise<unknown> {
  const serializedPayload = payload && typeof payload === 'object'
    ? serializePlainObject(payload as Record<string, unknown>)
    : payload

  try {
    return await schoolClient(options).queries[methodName](serializedPayload)
  }
  catch (error) {
    throw formatCoreError(`Core query failed for ${methodName}`, error)
  }
}

export async function postEntityList(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown> = {},
): Promise<unknown[]> {
  try {
    return await schoolClient(options).entities[serviceName].list(query)
  }
  catch (error) {
    throw formatCoreError(`Entity list failed for ${serviceName}`, error)
  }
}

export async function postEntityCount(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown> = {},
): Promise<number> {
  try {
    const result = await schoolClient(options).entities[serviceName].count(query)
    return typeof result?.count === 'number' ? result.count : 0
  }
  catch (error) {
    throw formatCoreError(`Entity count failed for ${serviceName}`, error)
  }
}

export async function postEntityFindById(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  id: string,
): Promise<unknown | undefined> {
  try {
    return await schoolClient(options).entities[serviceName].get(id)
  }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw formatCoreError(`Entity get failed for ${serviceName}/${id}`, error)
  }
}

export async function postEntityFindOne(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  query: Record<string, unknown>,
): Promise<unknown | undefined> {
  try {
    return await schoolClient(options).entities[serviceName].one(query)
  }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw formatCoreError(`Entity one failed for ${serviceName}`, error)
  }
}

export async function postEntitySave(
  options: CoreHttpRequestOptions,
  serviceName: SeedEntityKey,
  entity: unknown,
): Promise<void> {
  try {
    const resource = schoolClient(options).entities[serviceName]
    if (!('save' in resource) || typeof resource.save !== 'function') {
      throw new Error(`Entity ${serviceName} does not support direct save`)
    }
    await resource.save(entityPayload(entity) as never)
  }
  catch (error) {
    throw formatCoreError(`Entity save failed for ${serviceName}`, error)
  }
}

/** Uses the same managed entity invariants and atomic authorization as single saves. */
export async function postEntityBatchSave(options: CoreHttpRequestOptions, serviceName: SeedEntityKey, entities: unknown[]): Promise<void> {
  if (!entities.length)
    return
  try {
    const resource = schoolClient(options).entities[serviceName]
    if (!('batchSave' in resource) || typeof resource.batchSave !== 'function')
      throw new Error(`Entity ${serviceName} does not support batch save`)
    for (let offset = 0; offset < entities.length; offset += 500) await resource.batchSave({ entities: entities.slice(offset, offset + 500).map(entityPayload) as never[] })
  }
  catch (error) { throw formatCoreError(`Entity batch save failed for ${serviceName}`, error) }
}
