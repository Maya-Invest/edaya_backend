import type { HttpSeedClient } from '../transport/http/client'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { isSeedingServiceAccountApiKeyReady } from '../transport/http/verify-service-account'
import { signInViaHttp } from './auth/http-provisioner'

export const SEEDING_SERVICE_ID = 'seeding'

export interface ProvisionSeedingServiceAccountResult {
  status: 'created' | 'skipped' | 'reprovisioned' | 'key-synced'
  schoolId?: string
  apiKey?: string
  staffMemberId?: string
  reason?: string
}

interface SeedingServiceAccountRecord {
  id: string
  serviceId: string
  serviceElevated: boolean
  isActive: boolean
}

async function listSeedingServiceAccounts(
  client: HttpSeedClient,
): Promise<SeedingServiceAccountRecord[]> {
  const listResponse = await client.jsonRequest<SeedingServiceAccountRecord[]>('/core/service-accounts')
  if (!listResponse.response.ok) {
    const message = typeof listResponse.body === 'object' && listResponse.body && 'message' in listResponse.body
      ? String((listResponse.body as { message?: string }).message)
      : `HTTP ${listResponse.response.status}`
    throw new Error(`Failed to list seeding service accounts: ${message}`)
  }

  return (listResponse.body ?? []).filter(account => account.serviceId === SEEDING_SERVICE_ID)
}

async function revokeSeedingServiceAccountHttp(
  client: HttpSeedClient,
  staffMemberId: string,
): Promise<void> {
  const revokeResponse = await client.jsonRequest(`/core/service-accounts/${staffMemberId}/revoke`, {
    method: 'POST',
  })

  if (!revokeResponse.response.ok) {
    const message = typeof revokeResponse.body === 'object' && revokeResponse.body && 'message' in revokeResponse.body
      ? String((revokeResponse.body as { message?: string }).message)
      : `HTTP ${revokeResponse.response.status}`
    throw new Error(`Failed to revoke seeding service account: ${message}`)
  }
}

async function syncSeedingServiceAccountApiKeyHttp(
  client: HttpSeedClient,
  staffMemberId: string,
  apiKey: string,
): Promise<string> {
  const rotateResponse = await client.jsonRequest<{ apiKey: string }>(
    `/core/service-accounts/${staffMemberId}/rotate-key`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    },
  )

  if (!rotateResponse.response.ok || !rotateResponse.body?.apiKey) {
    const message = typeof rotateResponse.body === 'object' && rotateResponse.body && 'message' in rotateResponse.body
      ? String((rotateResponse.body as { message?: string }).message)
      : `HTTP ${rotateResponse.response.status}`
    throw new Error(`Failed to sync seeding service account API key: ${message}`)
  }

  return rotateResponse.body.apiKey
}

async function createSeedingServiceAccountHttp(
  client: HttpSeedClient,
  apiKey: string,
): Promise<{ apiKey: string, id: string }> {
  const createResponse = await client.jsonRequest<{ apiKey: string, id: string }>('/core/service-accounts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      serviceId: SEEDING_SERVICE_ID,
      name: 'Seeding Integration',
      elevated: true,
      apiKey,
    }),
  })

  if (!createResponse.response.ok || !createResponse.body?.apiKey || !createResponse.body.id) {
    const message = typeof createResponse.body === 'object' && createResponse.body && 'message' in createResponse.body
      ? String((createResponse.body as { message?: string }).message)
      : `HTTP ${createResponse.response.status}`
    throw new Error(`Failed to provision seeding service account: ${message}`)
  }

  return createResponse.body
}

export async function provisionSeedingServiceAccountHttp(
  client: HttpSeedClient,
  input: {
    schoolId?: string
    email?: string
    password?: string
    apiKey?: string
  } = {},
): Promise<ProvisionSeedingServiceAccountResult> {
  const context = resolveDevSeedContext()
  const schoolId = input.schoolId ?? context.schoolId
  const apiKey = input.apiKey ?? resolveSeedingApiKeyForSchool(schoolId)

  await signInViaHttp(client, {
    email: input.email ?? context.minimalStaffEmail,
    password: input.password ?? context.authPassword,
  })

  if (await isSeedingServiceAccountApiKeyReady(client, apiKey)) {
    const existing = (await listSeedingServiceAccounts(client)).find(account => account.isActive)
    return {
      status: 'skipped',
      schoolId,
      apiKey,
      staffMemberId: existing?.id,
      reason: 'Seeding service account API key from school profile is ready',
    }
  }

  const existingAccounts = await listSeedingServiceAccounts(client)
  const activeAccount = existingAccounts.find(account => account.isActive)

  if (activeAccount?.serviceElevated) {
    const syncedApiKey = await syncSeedingServiceAccountApiKeyHttp(client, activeAccount.id, apiKey)
    if (!await isSeedingServiceAccountApiKeyReady(client, syncedApiKey)) {
      throw new Error(
        'Seeding service account API key was rotated but is still not ready for attachment commands. '
        + 'Stop `bun repo dev`, run `bun repo ops seed clean --yes`, restart the API, then `bun repo ops seed`.',
      )
    }

    return {
      status: 'key-synced',
      schoolId,
      apiKey: syncedApiKey,
      staffMemberId: activeAccount.id,
      reason: 'Synced profile API key onto the elevated seeding service account',
    }
  }

  if (activeAccount) {
    await revokeSeedingServiceAccountHttp(client, activeAccount.id)
  }

  const created = await createSeedingServiceAccountHttp(client, apiKey)
  if (!await isSeedingServiceAccountApiKeyReady(client, created.apiKey)) {
    throw new Error(
      'Seeding service account was created but the profile API key is still not ready. '
      + 'Stop `bun repo dev`, run `bun repo ops seed clean --yes`, restart the API, then `bun repo ops seed`.',
    )
  }

  return {
    status: activeAccount ? 'reprovisioned' : 'created',
    schoolId,
    apiKey: created.apiKey,
    staffMemberId: created.id,
    reason: activeAccount
      ? 'Recreated elevated seeding service account for the profile API key'
      : undefined,
  }
}

export function logProvisionedServiceAccountKey(result: ProvisionSeedingServiceAccountResult): void {
  const schoolLabel = result.schoolId ?? resolveDevSeedContext().schoolId

  if ((result.status === 'created' || result.status === 'reprovisioned' || result.status === 'key-synced') && result.apiKey) {
    const verb = result.status === 'created'
      ? 'created'
      : result.status === 'key-synced'
        ? 'key synced for'
        : 'reprovisioned'
    // eslint-disable-next-line no-console
    console.log(`Seeding service account ${verb} ${schoolLabel} with the configured profile API key.`)
    return
  }

  if (result.status === 'skipped' && result.apiKey) {
    // eslint-disable-next-line no-console
    console.log(`Seeding service account already exists for ${schoolLabel}; using API key from school profile in fixtures.`)
  }
}
