import type { HttpSeedClient } from './client'

export interface ExecuteCoreCommandOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
  commandName: string
  payload: Record<string, unknown>
  requestId?: string
}

function coreHeaders(serviceAccountApiKey: string | undefined, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(serviceAccountApiKey ? { authorization: `Bearer ${serviceAccountApiKey}` } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

export async function executeCoreCommand<T = Record<string, unknown>>(
  options: ExecuteCoreCommandOptions,
): Promise<{ response: Response, body: T | null }> {
  const { client, serviceAccountApiKey, commandName, payload, requestId } = options

  return client.jsonRequest<T>(`/core/commands/${commandName}`, {
    method: 'POST',
    headers: coreHeaders(serviceAccountApiKey, requestId),
    body: JSON.stringify(payload),
  })
}
