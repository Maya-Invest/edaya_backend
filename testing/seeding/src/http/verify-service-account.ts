import type { HttpSeedClient } from './client'

/** Returns false when the configured key is missing or rejected by the API. */
export async function isServiceAccountApiKeyValid(
  client: HttpSeedClient,
  serviceAccountApiKey: string | undefined,
): Promise<boolean> {
  if (!serviceAccountApiKey) {
    return false
  }

  const { response } = await client.jsonRequest('/core/authorization/effective-grants', {
    headers: {
      authorization: `Bearer ${serviceAccountApiKey}`,
    },
  })

  return response.ok
}
