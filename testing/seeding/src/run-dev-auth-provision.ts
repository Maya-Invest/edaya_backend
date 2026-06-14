import type { AuthProvisioner } from './types'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
} from '@edaya/dev-fixtures'

export type DevAuthProvisionResult
  = | { status: 'seeded', accounts: Array<{ email: string, subjectId: string, kind: 'staff' | 'guardian' }> }

export async function runDevAuthProvision(
  auth: AuthProvisioner,
): Promise<DevAuthProvisionResult> {
  const accounts: DevAuthProvisionResult['accounts'] = []

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
  }

  return {
    status: 'seeded',
    accounts,
  }
}
