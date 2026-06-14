import type { HttpSeedClient } from './client'

export interface SystemCommandRequest {
  schoolId: string
  systemId: string
  reason: string
  payload: Record<string, unknown>
}

export interface ExecuteSystemCommandOptions {
  client: HttpSeedClient
  systemActorSecret: string
  commandName: string
  body: SystemCommandRequest
  requestId?: string
}

export async function executeSystemCommand<T = Record<string, unknown>>(
  options: ExecuteSystemCommandOptions,
): Promise<{ response: Response, body: T | null }> {
  const { client, systemActorSecret, commandName, body, requestId } = options

  return client.jsonRequest<T>(`/core/system/commands/${commandName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-system-actor-secret': systemActorSecret,
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    body: JSON.stringify(body),
  })
}
