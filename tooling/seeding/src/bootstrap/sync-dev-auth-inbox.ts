import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { CommunicationsSeedPort } from '../domains/communications/port'
import type { AuthProvisioner } from '../support/types'
import type { DevStaffAuthSyncOptions, DevStaffAuthSyncResult } from './dev-staff-auth-seed'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { seedAuthLinkedGuardianInboxProbes } from '../domains/communications/guardian-inbox-probe'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'

export async function syncDevAuthAndGuardianInboxProbes(
  authLinkPort: AuthLinkSeedPort,
  communicationsPort: CommunicationsSeedPort,
  auth: AuthProvisioner,
  ownerSubjectId?: string,
  options?: DevStaffAuthSyncOptions,
): Promise<DevStaffAuthSyncResult | null> {
  const sync = await syncDevStaffAuthAndOwner(authLinkPort, auth, ownerSubjectId, options)
  if (!sync) {
    return null
  }

  const context = resolveDevSeedContext()
  const guardianIds = context.guardianAccounts.map(account => account.guardianId)
  await seedAuthLinkedGuardianInboxProbes(
    communicationsPort,
    authLinkPort,
    context.dataset,
    guardianIds,
  )

  return sync
}
