import type { HttpSeedClient } from '../transport/http/client'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveChildrenAiS2sApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { bootstrapHttpCoreSession } from './session/http-core-session'

export const CHILDREN_AI_S2S_CLIENT_ID = 'children-ai'

export interface ProvisionChildrenAiS2sClientResult {
  status: 'created' | 'rotated' | 'skipped'
  schoolId?: string
  clientId?: string
  reason?: string
}

type S2sClientRecord = {
  id: string
  clientId: string
  schoolId: string
  isActive: boolean
}

const platformHeaders = {
  'content-type': 'application/json',
  'x-actor-kind': 'platform',
} as const

export async function provisionChildrenAiS2sClientHttp(
  client: HttpSeedClient,
  input: { schoolId?: string, apiKey?: string } = {},
): Promise<ProvisionChildrenAiS2sClientResult> {
  const context = resolveDevSeedContext()
  const schoolId = input.schoolId ?? context.schoolId
  const apiKey = input.apiKey ?? resolveChildrenAiS2sApiKeyForSchool(schoolId)
  if (!apiKey) {
    return {
      status: 'skipped',
      schoolId,
      reason: `No children-ai S2S key fixture for school ${schoolId}`,
    }
  }

  await bootstrapHttpCoreSession(client)

  const list = await client.jsonRequest<S2sClientRecord[]>(
    `/core/s2s-clients?schoolId=${encodeURIComponent(schoolId)}`,
    { headers: { 'x-actor-kind': 'platform' } },
  )
  if (list.response.status === 401 || list.response.status === 403) {
    throw new Error(
      'Platform actor required to mint the children-ai S2S key. '
      + 'Set PLATFORM_BOOTSTRAP_EMAILS to the demo owner email '
      + `(${context.staffAccounts.find(account => account.staffId === context.ownerStaffId)?.email ?? 'school owner'}) `
      + 'in edaya_backend/apps/api/.env, restart the API, then retry `bun repo seed`.',
    )
  }
  if (!list.response.ok) {
    const message = typeof list.body === 'object' && list.body && 'message' in list.body
      ? String((list.body as { message?: string }).message)
      : `HTTP ${list.response.status}`
    throw new Error(`Failed to list S2S clients: ${message}`)
  }

  const existing = (list.body ?? []).find(
    row => row.clientId === CHILDREN_AI_S2S_CLIENT_ID && row.isActive,
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
      throw new Error(`Failed to rotate children-ai S2S key: ${message}`)
    }
    return { status: 'rotated', schoolId, clientId: CHILDREN_AI_S2S_CLIENT_ID }
  }

  const created = await client.jsonRequest<{ apiKey: string, id: string }>(
    '/core/s2s-clients',
    {
      method: 'POST',
      headers: platformHeaders,
      body: JSON.stringify({
        schoolId,
        clientId: CHILDREN_AI_S2S_CLIENT_ID,
        accessClass: 'read',
        apiKey,
      }),
    },
  )
  if (!created.response.ok) {
    const message = typeof created.body === 'object' && created.body && 'message' in created.body
      ? String((created.body as { message?: string }).message)
      : `HTTP ${created.response.status}`
    throw new Error(`Failed to create children-ai S2S client: ${message}`)
  }
  return { status: 'created', schoolId, clientId: CHILDREN_AI_S2S_CLIENT_ID }
}

export function logProvisionedChildrenAiS2sClient(result: ProvisionChildrenAiS2sClientResult): void {
  if (result.status === 'skipped') {
    console.log(`Children AI S2S: skipped (${result.reason ?? 'no fixture key'})`)
    return
  }
  console.log(`Children AI S2S: ${result.status} clientId=${result.clientId} school=${result.schoolId}`)
}
