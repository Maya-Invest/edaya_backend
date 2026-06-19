import type { AuthProvisioner, SeedApplication } from './types'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'

export type DevAuthLinkResult
  = | { status: 'skipped', reason: 'school-not-seeded' | 'already-linked', linkedStaff: number, linkedGuardians: number }
    | {
      status: 'seeded'
      linkedStaff: number
      linkedGuardians: number
      accounts: Array<{ email: string, kind: 'staff' | 'guardian', entityId: string }>
    }

/** @deprecated Prefer `syncDevStaffAuthAndOwner` via school/access seed. Kept for integration tests. */
export async function runDevAuthLink(
  application: SeedApplication,
  auth: AuthProvisioner,
): Promise<DevAuthLinkResult> {
  const sync = await syncDevStaffAuthAndOwner(application, auth)
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
