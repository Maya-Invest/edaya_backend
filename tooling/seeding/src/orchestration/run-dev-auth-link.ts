import type { DevStaffAuthSyncOptions } from '../bootstrap/dev-staff-auth-seed'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { CommunicationsSeedPort } from '../domains/communications/port'
import type { AuthProvisioner } from '../support/types'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { syncDevAuthAndGuardianInboxProbes } from '../bootstrap/sync-dev-auth-inbox'

export type DevAuthLinkResult
  = | { status: 'skipped', reason: 'school-not-seeded' | 'already-linked', linkedStaff: number, linkedTeachers: number, linkedGuardians: number }
    | {
      status: 'seeded'
      linkedStaff: number
      linkedTeachers: number
      linkedGuardians: number
      accounts: Array<{ email: string, kind: 'staff' | 'teacher' | 'guardian', entityId: string }>
    }

export interface RunDevAuthLinkOptions extends DevStaffAuthSyncOptions {
  communicationsPort?: CommunicationsSeedPort
}

export async function runDevAuthLinkWithPort(
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
  options?: RunDevAuthLinkOptions,
): Promise<DevAuthLinkResult> {
  const context = resolveDevSeedContext()
  const school = await port.findSchoolById(context.schoolId)
  if (!school) {
    return {
      status: 'skipped',
      reason: 'school-not-seeded',
      linkedStaff: 0,
      linkedTeachers: 0,
      linkedGuardians: 0,
    }
  }

  const sync = options?.communicationsPort
    ? await syncDevAuthAndGuardianInboxProbes(
        port,
        options.communicationsPort,
        auth,
        undefined,
        options,
      )
    : await syncDevStaffAuthAndOwner(port, auth, undefined, options)

  if (!sync) {
    return {
      status: 'skipped',
      reason: 'school-not-seeded',
      linkedStaff: 0,
      linkedTeachers: 0,
      linkedGuardians: 0,
    }
  }

  if (sync.linkedStaff === 0 && sync.linkedTeachers === 0 && sync.linkedGuardians === 0) {
    return {
      status: 'skipped',
      reason: 'already-linked',
      linkedStaff: 0,
      linkedTeachers: 0,
      linkedGuardians: 0,
    }
  }

  return {
    status: 'seeded',
    linkedStaff: sync.linkedStaff,
    linkedTeachers: sync.linkedTeachers,
    linkedGuardians: sync.linkedGuardians,
    accounts: [],
  }
}
