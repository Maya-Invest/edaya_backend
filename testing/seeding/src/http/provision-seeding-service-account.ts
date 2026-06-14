import type { SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import {
  ActorAssuranceLevel,
  createServiceAccount,
  createStaffActorMetadata,
} from '@edaya/core'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { signInViaHttp } from './auth'

export const SEEDING_SERVICE_ID = 'seeding'

export interface ProvisionSeedingServiceAccountResult {
  status: 'created' | 'skipped'
  apiKey?: string
  staffMemberId?: string
  reason?: string
}

export async function provisionSeedingServiceAccountInProcess(
  application: SeedApplication,
  creatorStaffId: string = MINIMAL_AUTH_FIXTURE_STAFF_ID,
): Promise<ProvisionSeedingServiceAccountResult> {
  const existing = await application.repositories.staffMembers.findOne({
    schoolId: SEED_SCHOOL_ID,
    accountKind: 'service',
    serviceId: SEEDING_SERVICE_ID,
    isActive: true,
  })

  if (existing) {
    return {
      status: 'skipped',
      staffMemberId: existing.id,
      reason: 'Active seeding service account already exists; set SERVICE_ACCOUNT_API_KEY or rotate the key',
    }
  }

  const staff = await application.repositories.staffMembers.findById(creatorStaffId)
  if (!staff?.subjectId) {
    throw new Error(`Cannot provision seeding service account: staff ${creatorStaffId} is not linked to auth`)
  }

  const grants = await application.repositories.authorization.resolveEffectiveGrants({
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
  })

  const actor = createStaffActorMetadata({
    subjectId: staff.subjectId,
    staffMemberId: creatorStaffId,
    schoolId: SEED_SCHOOL_ID,
    requestId: 'seed-service-account',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Standard,
    effectiveGrants: grants,
  })

  const result = await createServiceAccount(application.repositories, actor, {
    serviceId: SEEDING_SERVICE_ID,
    displayName: 'Seeding Integration',
    roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
    elevated: true,
  })

  return {
    status: 'created',
    apiKey: result.apiKey,
    staffMemberId: result.staffMember.id,
  }
}

export async function provisionSeedingServiceAccountHttp(
  client: HttpSeedClient,
  input: {
    email?: string
    password?: string
  } = {},
): Promise<ProvisionSeedingServiceAccountResult> {
  await signInViaHttp(client, {
    email: input.email ?? MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
    password: input.password ?? DEV_AUTH_PASSWORD,
  })

  const listResponse = await client.jsonRequest<Array<{ serviceId: string, id: string }>>('/core/service-accounts')
  if (listResponse.response.ok) {
    const existing = (listResponse.body ?? []).find(account => account.serviceId === SEEDING_SERVICE_ID)
    if (existing) {
      return {
        status: 'skipped',
        staffMemberId: existing.id,
        reason: 'Active seeding service account already exists; set SERVICE_ACCOUNT_API_KEY or rotate the key',
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
      roleIds: [DEV_AUTH_STAFF_ACCESS_ROLE_IDS.st5],
      elevated: true,
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
    apiKey: createResponse.body?.apiKey,
    staffMemberId: createResponse.body?.id,
  }
}

export function logProvisionedServiceAccountKey(result: ProvisionSeedingServiceAccountResult): void {
  if (result.status !== 'created' || !result.apiKey) {
    return
  }

  // eslint-disable-next-line no-console
  console.log('Seeding service account created. Add to apps/api/.env:')
  // eslint-disable-next-line no-console
  console.log(`SERVICE_ACCOUNT_API_KEY=${result.apiKey}`)
}
