import type { SeedApplication } from '../support/types'
import type { HttpSeedClient } from './client'
import {
  ActorAssuranceLevel,
  createServiceAccount,
  createStaffActorMetadata,
} from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { signInViaHttp } from './auth'

export const SEEDING_SERVICE_ID = 'seeding'

export interface ProvisionSeedingServiceAccountResult {
  status: 'created' | 'skipped'
  schoolId?: string
  apiKey?: string
  staffMemberId?: string
  reason?: string
}

export async function provisionSeedingServiceAccountInProcess(
  application: SeedApplication,
  input: {
    schoolId?: string
    creatorStaffId?: string
    apiKey?: string
  } = {},
): Promise<ProvisionSeedingServiceAccountResult> {
  const context = resolveDevSeedContext()
  const schoolId = input.schoolId ?? context.schoolId
  const creatorStaffId = input.creatorStaffId ?? context.minimalStaffId
  const apiKey = input.apiKey ?? resolveSeedingApiKeyForSchool(schoolId)

  const existing = await application.repositories.staffMembers.findOne({
    schoolId,
    accountKind: 'service',
    serviceId: SEEDING_SERVICE_ID,
    isActive: true,
  })

  if (existing) {
    return {
      status: 'skipped',
      schoolId,
      apiKey,
      staffMemberId: existing.id,
      reason: 'Active seeding service account already exists',
    }
  }

  const staff = await application.repositories.staffMembers.findById(creatorStaffId)
  if (!staff?.subjectId) {
    throw new Error(`Cannot provision seeding service account: staff ${creatorStaffId} is not linked to auth`)
  }

  const grants = await application.repositories.authorization.resolveEffectiveGrants({
    staffMemberId: creatorStaffId,
    schoolId,
  })

  const actor = createStaffActorMetadata({
    subjectId: staff.subjectId,
    staffMemberId: creatorStaffId,
    schoolId,
    requestId: 'seed-service-account',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Standard,
    effectiveGrants: grants,
  })

  const elevatedRoleStaffId = context.datasetId === 'ci' ? 'ci-st5' : 'st5'
  const result = await createServiceAccount(application.repositories, actor, {
    serviceId: SEEDING_SERVICE_ID,
    displayName: 'Seeding Integration',
    roleIds: [context.staffAccessRoleIds[elevatedRoleStaffId]!],
    elevated: true,
    apiKey,
  })

  return {
    status: 'created',
    schoolId,
    apiKey: result.apiKey,
    staffMemberId: result.staffMember.id,
  }
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

  const listResponse = await client.jsonRequest<Array<{ serviceId: string, id: string }>>('/core/service-accounts')
  if (listResponse.response.ok) {
    const existing = (listResponse.body ?? []).find(account => account.serviceId === SEEDING_SERVICE_ID)
    if (existing) {
      return {
        status: 'skipped',
        schoolId,
        apiKey,
        staffMemberId: existing.id,
        reason: 'Active seeding service account already exists',
      }
    }
  }

  const createResponse = await client.jsonRequest<{ apiKey: string, id: string }>('/core/service-accounts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      serviceId: SEEDING_SERVICE_ID,
      displayName: 'Seeding Integration',
      roleIds: [context.staffAccessRoleIds[context.minimalStaffId]!],
      elevated: true,
      apiKey,
    }),
  })

  if (!createResponse.response.ok) {
    const message = typeof createResponse.body === 'object' && createResponse.body && 'message' in createResponse.body
      ? String((createResponse.body as { message?: string }).message)
      : `HTTP ${createResponse.response.status}`
    throw new Error(`Failed to provision seeding service account: ${message}`)
  }

  return {
    status: 'created',
    schoolId,
    apiKey: createResponse.body?.apiKey,
    staffMemberId: createResponse.body?.id,
  }
}

export function logProvisionedServiceAccountKey(result: ProvisionSeedingServiceAccountResult): void {
  const schoolLabel = result.schoolId ?? resolveDevSeedContext().schoolId

  if (result.status === 'created' && result.apiKey) {
    // eslint-disable-next-line no-console
    console.log(`Seeding service account created for ${schoolLabel} with profile API key (${result.apiKey.slice(0, 16)}…).`)
    return
  }

  if (result.status === 'skipped' && result.apiKey) {
    // eslint-disable-next-line no-console
    console.log(`Seeding service account already exists for ${schoolLabel}; using API key from school profile in fixtures.`)
  }
}
