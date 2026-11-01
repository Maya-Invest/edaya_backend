import type { Transport } from '@maya-invest/edaya-api-client'
import type { HttpSeedClient } from './client'
import { ApiError } from '@maya-invest/edaya-api-client'

export interface SeedTransportOptions {
  serviceAccountApiKey?: string
  requestId?: string
  actor?: { schoolId: string, actorId: string, academicYearId: string }
}

function seedHeaders(options: SeedTransportOptions): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(options.actor ? { 'x-school-id': options.actor.schoolId, 'x-actor-kind': 'staff', 'x-actor-id': options.actor.actorId, 'x-academic-year-id': options.actor.academicYearId } : {}),
    ...(options.serviceAccountApiKey ? { authorization: `Bearer ${options.serviceAccountApiKey}` } : {}),
    ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
  }
}

export function createSeedTransport(
  client: HttpSeedClient,
  options: SeedTransportOptions = {},
): Transport {
  return {
    async request<T>(method: string, path: string, requestOptions?: { body?: unknown }): Promise<T> {
      const { response, body } = await client.jsonRequest<T>(path, {
        method,
        headers: seedHeaders(options),
        body: requestOptions?.body !== undefined ? JSON.stringify(requestOptions.body) : undefined,
      })

      if (!response.ok) {
        throw new ApiError(response.status, body)
      }

      return body as T
    },
  }
}
