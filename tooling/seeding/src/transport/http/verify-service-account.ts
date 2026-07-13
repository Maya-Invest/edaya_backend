import type { HttpSeedClient } from './client'

interface EffectiveGrantsBody {
  effectiveGrants?: {
    permissions?: string[]
    isElevated?: boolean
  }
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

  const { response, body } = await client.jsonRequest<EffectiveGrantsBody>(
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

  const grants = body?.effectiveGrants
  if (grants?.isElevated) {
    return true
  }

  return grants?.permissions?.includes('ATTACHMENT_CONFIGURE') ?? false
}
