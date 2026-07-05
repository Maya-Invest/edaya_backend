import type { HttpSeedClient } from '@edaya/seeding/http'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { bootstrapHttpCoreSession } from '@edaya/seeding/bootstrap'
import { runHttpDevSeeds } from '@edaya/seeding/http'

const DOMAIN_SCOPES = ['school', 'auth:link', 'access'] as const

export interface BootstrapHttpSeedOptions {
  withProfilePhotos?: boolean
}

/** Minimal HTTP seed chain for doctor/validate slice tests (no full `scope: all` orchestration). */
export async function bootstrapHttpSeedForDiagnostics(
  client: HttpSeedClient,
  options: BootstrapHttpSeedOptions = {},
): Promise<string> {
  await runHttpDevSeeds({ client, scope: 'auth' })
  await bootstrapHttpCoreSession(client)

  await runHttpDevSeeds({
    client,
    scope: 'service-account',
    provisionServiceAccount: true,
  })

  const serviceAccountApiKey = resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID)

  for (const scope of DOMAIN_SCOPES) {
    await runHttpDevSeeds({
      client,
      scope,
      serviceAccountApiKey,
      provisionServiceAccount: false,
    })
  }

  if (options.withProfilePhotos) {
    await runHttpDevSeeds({
      client,
      scope: 'profile-pictures',
      serviceAccountApiKey,
      provisionServiceAccount: false,
    })
  }

  return serviceAccountApiKey
}
