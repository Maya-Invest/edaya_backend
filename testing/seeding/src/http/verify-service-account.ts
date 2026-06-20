import type { HttpSeedClient } from './client'

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
      authorization: `Bearer ${serviceAccountApiKey}`,
    },
    body: JSON.stringify({}),
  })

  return response.ok
}
