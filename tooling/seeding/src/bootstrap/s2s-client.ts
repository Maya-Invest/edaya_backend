import type { HttpSeedClient } from '../transport/http/client'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveEdayaSparkS2sApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { bootstrapHttpCoreSession } from './session/http-core-session'

export const EDAYA_SPARK_S2S_CLIENT_ID = 'edaya-spark'

export interface ProvisionEdayaSparkS2sClientResult {
  status: 'created' | 'rotated' | 'skipped'
  schoolId?: string
  clientId?: string
  reason?: string
}

interface S2sClientRecord {
  id: string
  clientId: string
  schoolId: string
  isActive: boolean
}

const platformHeaders = {
  'content-type': 'application/json',
  'x-actor-kind': 'platform',
} as const

export async function provisionEdayaSparkS2sClientHttp(
  client: HttpSeedClient,
  input: { schoolId?: string, apiKey?: string } = {},
): Promise<ProvisionEdayaSparkS2sClientResult> {
  const context = resolveDevSeedContext()
  const schoolId = input.schoolId ?? context.schoolId
  const apiKey = input.apiKey ?? resolveEdayaSparkS2sApiKeyForSchool(schoolId)
  if (!apiKey) {
    return {
      status: 'skipped',
      schoolId,
      reason: `No edaya-spark S2S key fixture for school ${schoolId}`,
    }
  }

  await bootstrapHttpCoreSession(client)

  const list = await client.jsonRequest<S2sClientRecord[]>(
    `/core/s2s-clients?schoolId=${encodeURIComponent(schoolId)}`,
    { headers: { 'x-actor-kind': 'platform' } },
  )
  if (list.response.status === 401 || list.response.status === 403) {
    throw new Error(
      'Platform actor required to mint the edaya-spark S2S key. '
      + 'Set PLATFORM_BOOTSTRAP_EMAILS to the demo owner email '
      + `(${context.staffAccounts.find(account => account.staffId === context.ownerStaffId)?.email ?? 'school owner'}) `
      + 'in apps/api/config.local.jsonc, restart the API, then retry `bun repo ops seed --scope s2s-clients`.',
    )
  }
  if (!list.response.ok) {
    const message = typeof list.body === 'object' && list.body && 'message' in list.body
      ? String((list.body as { message?: string }).message)
      : `HTTP ${list.response.status}`
    throw new Error(`Failed to list S2S clients: ${message}`)
  }

  const existing = (list.body ?? []).find(
    row => row.clientId === EDAYA_SPARK_S2S_CLIENT_ID && row.isActive,
  )
  if (existing) {
    const rotate = await client.jsonRequest<{ apiKey: string }>(
      `/core/s2s-clients/${existing.id}/rotate-key`,
      {
        method: 'POST',
        headers: platformHeaders,
        body: JSON.stringify({ apiKey }),
      },
    )
    if (!rotate.response.ok) {
      const message = typeof rotate.body === 'object' && rotate.body && 'message' in rotate.body
        ? String((rotate.body as { message?: string }).message)
        : `HTTP ${rotate.response.status}`
      throw new Error(`Failed to rotate edaya-spark S2S key: ${message}`)
    }
    return { status: 'rotated', schoolId, clientId: EDAYA_SPARK_S2S_CLIENT_ID }
  }

  const created = await client.jsonRequest<{ apiKey: string, id: string }>(
    '/core/s2s-clients',
    {
      method: 'POST',
      headers: platformHeaders,
      body: JSON.stringify({
        schoolId,
        clientId: EDAYA_SPARK_S2S_CLIENT_ID,
        accessClass: 'read',
        apiKey,
      }),
    },
  )
  if (!created.response.ok) {
    const message = typeof created.body === 'object' && created.body && 'message' in created.body
      ? String((created.body as { message?: string }).message)
      : `HTTP ${created.response.status}`
    throw new Error(`Failed to create edaya-spark S2S client: ${message}`)
  }
  return { status: 'created', schoolId, clientId: EDAYA_SPARK_S2S_CLIENT_ID }
}

export function logProvisionedEdayaSparkS2sClient(result: ProvisionEdayaSparkS2sClientResult): void {
  if (result.status === 'skipped') {
    // eslint-disable-next-line no-console -- CLI provisioning status contains no credentials.
    console.log(`EDaya Spark S2S: skipped (${result.reason ?? 'no fixture key'})`)
    return
  }
  // eslint-disable-next-line no-console -- CLI provisioning status contains no credentials.
  console.log(`EDaya Spark S2S: ${result.status} clientId=${result.clientId} school=${result.schoolId}`)
}
