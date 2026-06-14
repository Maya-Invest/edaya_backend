import type { AuthProvisioner } from './types'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
} from '@edaya/dev-fixtures'

const AUTH_REQUEST_PAUSE_MS = 250
const STAGING_AUTH_REQUEST_PAUSE_MS = 750

async function pauseBetweenAuthRequests(baseUrl?: string): Promise<void> {
  const delayMs = baseUrl?.includes('api-staging.')
    ? STAGING_AUTH_REQUEST_PAUSE_MS
    : AUTH_REQUEST_PAUSE_MS
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

export type DevAuthProvisionResult
  = | { status: 'seeded', accounts: Array<{ email: string, subjectId: string, kind: 'staff' | 'guardian' }> }

export async function runDevAuthProvision(
  auth: AuthProvisioner,
  options: { baseUrl?: string } = {},
): Promise<DevAuthProvisionResult> {
  const accounts: DevAuthProvisionResult['accounts'] = []
  const { baseUrl } = options

  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    })
    accounts.push({
      email: account.email,
      subjectId,
      kind: 'staff',
    })
    await pauseBetweenAuthRequests(baseUrl)
  }

  for (const account of DEV_AUTH_GUARDIAN_ACCOUNTS) {
    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    })
    accounts.push({
      email: account.email,
      subjectId,
      kind: 'guardian',
    })
    await pauseBetweenAuthRequests(baseUrl)
  }

  return {
    status: 'seeded',
    accounts,
  }
}
