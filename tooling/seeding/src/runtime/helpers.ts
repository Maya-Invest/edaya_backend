import type { HttpSeedClient } from '../transport/http/client'
import type { RunHttpDevSeedsOptions, RunHttpDevSeedsResults } from './types'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
} from '../bootstrap/service-account'
import { postEntityList } from '../transport/http/core-entity'
import { isServiceAccountApiKeyValid } from '../transport/http/verify-service-account'

export function createEmptyHttpSeedResults(): RunHttpDevSeedsResults {
  return {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
    profilePhotos: null,
    smoke: null,
    validation: null,
    doctor: null,
    doctorRepair: null,
  }
}

export async function resolveServiceAccountApiKey(
  client: HttpSeedClient,
  options: RunHttpDevSeedsOptions,
  profileSeedingApiKey: string,
): Promise<string | undefined> {
  let serviceAccountApiKey: string | undefined = options.serviceAccountApiKey ?? profileSeedingApiKey
  if (serviceAccountApiKey && options.scope !== 'auth') {
    const valid = await isServiceAccountApiKeyValid(client, serviceAccountApiKey)
    if (!valid) {
      console.warn(
        'Seeding API key from the school profile in @edaya/fixtures was rejected by the API (401). '
        + 'Using session bootstrap to register the school and provision the seeding service account.',
      )
      serviceAccountApiKey = undefined
    }
  }
  return serviceAccountApiKey
}

export async function hasSeededSchools(
  client: HttpSeedClient,
  serviceAccountApiKey: string | undefined,
): Promise<boolean> {
  const schools = await postEntityList(
    {
      client,
      serviceAccountApiKey,
      requestId: 'http-seed-smoke',
    },
    'schools',
  )
  return schools.length > 0
}

export async function canUseSeedingServiceAccount(
  client: HttpSeedClient,
  apiKey: string,
): Promise<boolean> {
  const grants = await client.jsonRequest('/core/authorization/effective-grants', {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  })
  return grants.response.ok
}

export async function maybeProvisionSeedingServiceAccount(
  options: RunHttpDevSeedsOptions,
  serviceAccountApiKey: string | undefined,
): Promise<void> {
  if (serviceAccountApiKey || options.provisionServiceAccount === false) {
    return
  }

  const result = await provisionSeedingServiceAccountHttp(options.client)
  logProvisionedServiceAccountKey(result)
}
