import type { HttpSeedClient } from './client'

interface ActionGrantsBody {
  grants?: Array<{ permission: string, scopes: Array<{ kind: string }> }>
}

/** Returns false when the configured key is missing or rejected by the API. */
export async function isServiceAccountApiKeyValid(
  client: HttpSeedClient,
  serviceAccountApiKey: string | undefined,
): Promise<boolean> {
  if (!serviceAccountApiKey) {
    return false
  }

  const { response } = await client.jsonRequest('/core/entities/schools/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${serviceAccountApiKey}`,
    },
    body: JSON.stringify({}),
  })

  return response.ok
}

/** True when the key authenticates and can run attachment seed commands. */
export async function isSeedingServiceAccountApiKeyReady(
  client: HttpSeedClient,
  serviceAccountApiKey: string | undefined,
): Promise<boolean> {
  if (!await isServiceAccountApiKeyValid(client, serviceAccountApiKey)) {
    return false
  }

  const { response, body } = await client.jsonRequest<ActionGrantsBody>(
    '/core/authorization/effective-grants',
    {
      headers: {
        authorization: `Bearer ${serviceAccountApiKey}`,
      },
    },
  )

  if (!response.ok) {
    return false
  }

  return body?.grants?.some(grant => grant.permission === 'ATTACHMENT_CONFIGURE'
    && grant.scopes.some(scope => scope.kind === 'school')) ?? false
}
