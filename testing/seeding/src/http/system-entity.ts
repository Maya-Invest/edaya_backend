import type { ActorMetadata } from '@edaya/core'
import type { HttpSeedClient } from './client'
import { commandMethodToPublicName, entityPublicName } from './names'
import { executeSystemCommand } from './system-command'

export interface SystemActorContext {
  schoolId: string
  systemId: string
  reason: string
}

export interface SystemHttpRequestOptions {
  client: HttpSeedClient
  systemActorSecret: string
  actor: ActorMetadata
  requestId?: string
}

function actorContext(actor: ActorMetadata): SystemActorContext {
  if (actor.kind !== 'system') {
    throw new Error('System HTTP requests require a system actor')
  }

  return {
    schoolId: actor.schoolId,
    systemId: actor.systemId,
    reason: actor.reason,
  }
}

function systemHeaders(systemActorSecret: string, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-system-actor-secret': systemActorSecret,
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

  throw new Error('Cannot serialize entity for HTTP system save')
}

export async function postSystemCommand(
  options: SystemHttpRequestOptions,
  methodName: string,
  payload: unknown,
): Promise<unknown> {
  const context = actorContext(options.actor)
  const { body } = await executeSystemCommand<Record<string, unknown>>({
    client: options.client,
    systemActorSecret: options.systemActorSecret,
    commandName: commandMethodToPublicName(methodName),
    requestId: options.requestId ?? options.actor.requestId,
    body: {
      ...context,
      payload: payload as Record<string, unknown>,
    },
  })

  return body
}

export async function postSystemEntityList(
  options: SystemHttpRequestOptions,
  serviceName: string,
  query: Record<string, unknown> = {},
): Promise<unknown[]> {
  const context = actorContext(options.actor)
  const { response, body } = await options.client.jsonRequest<unknown[]>(
    `/core/system/entities/${entityPublicName(serviceName)}/list`,
    {
      method: 'POST',
      headers: systemHeaders(options.systemActorSecret, options.requestId ?? options.actor.requestId),
      body: JSON.stringify({
        ...context,
        query,
      }),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`System entity list failed for ${serviceName}: ${response.status} ${message}`)
  }

  return body ?? []
}

export async function postSystemEntityFindById(
  options: SystemHttpRequestOptions,
  serviceName: string,
  id: string,
): Promise<unknown | undefined> {
  const context = actorContext(options.actor)
  const query = new URLSearchParams({
    schoolId: context.schoolId,
    systemId: context.systemId,
    reason: context.reason,
  })
  const { response, body } = await options.client.jsonRequest(
    `/core/system/entities/${entityPublicName(serviceName)}/${encodeURIComponent(id)}?${query.toString()}`,
    {
      method: 'GET',
      headers: systemHeaders(options.systemActorSecret, options.requestId ?? options.actor.requestId),
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`System entity get failed for ${serviceName}/${id}: ${response.status}`)
  }

  return body ?? undefined
}

export async function postSystemEntityFindOne(
  options: SystemHttpRequestOptions,
  serviceName: string,
  query: Record<string, unknown>,
): Promise<unknown | undefined> {
  const context = actorContext(options.actor)
  const { response, body } = await options.client.jsonRequest(
    `/core/system/entities/${entityPublicName(serviceName)}/one`,
    {
      method: 'POST',
      headers: systemHeaders(options.systemActorSecret, options.requestId ?? options.actor.requestId),
      body: JSON.stringify({
        ...context,
        query,
      }),
    },
  )

  if (response.status === 404) {
    return undefined
  }

  if (!response.ok) {
    throw new Error(`System entity one failed for ${serviceName}: ${response.status}`)
  }

  return body ?? undefined
}

export async function postSystemEntitySave(
  options: SystemHttpRequestOptions,
  serviceName: string,
  entity: unknown,
): Promise<void> {
  const context = actorContext(options.actor)
  const { response, body } = await options.client.jsonRequest(
    `/core/system/entities/${entityPublicName(serviceName)}/save`,
    {
      method: 'POST',
      headers: systemHeaders(options.systemActorSecret, options.requestId ?? options.actor.requestId),
      body: JSON.stringify({
        ...context,
        entity: entityPayload(entity),
      }),
    },
  )

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`System entity save failed for ${serviceName}: ${response.status} ${message}`)
  }
}
