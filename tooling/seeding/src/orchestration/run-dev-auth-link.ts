import type { DevStaffAuthSyncOptions } from '../bootstrap/dev-staff-auth-seed'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner } from '../support/types'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'

export type DevAuthLinkResult
  = | { status: 'skipped', reason: 'school-not-seeded' | 'already-linked', linkedStaff: number, linkedGuardians: number }
    | {
      status: 'seeded'
      linkedStaff: number
      linkedGuardians: number
      accounts: Array<{ email: string, kind: 'staff' | 'guardian', entityId: string }>
    }

export async function runDevAuthLinkWithPort(
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
  options?: DevStaffAuthSyncOptions,
): Promise<DevAuthLinkResult> {
  const sync = await syncDevStaffAuthAndOwner(port, auth, undefined, options)
  if (!sync) {
    return { status: 'skipped', reason: 'school-not-seeded', linkedStaff: 0, linkedGuardians: 0 }
  }

  if (sync.linkedStaff === 0 && sync.linkedGuardians === 0) {
    return { status: 'skipped', reason: 'already-linked', linkedStaff: 0, linkedGuardians: 0 }
  }

  return {
    status: 'seeded',
    linkedStaff: sync.linkedStaff,
    linkedGuardians: sync.linkedGuardians,
    accounts: [],
  }
}
