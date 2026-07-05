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

/** Legacy raw HTTP helper retained for scripts that inspect Response status directly. */
export async function executeCoreCommand<T = Record<string, unknown>>(
  options: ExecuteCoreCommandOptions,
): Promise<{ response: Response, body: T | null }> {
  return options.client.jsonRequest<T>(`/core/commands/${options.commandName}`, {
    method: 'POST',
    headers: coreHeaders(options.serviceAccountApiKey, options.requestId),
    body: JSON.stringify(options.payload),
  })
}
