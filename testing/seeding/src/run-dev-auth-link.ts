import type { AuthProvisioner, SeedApplication } from './types'
import { createBootstrapStaffActorMetadata } from '@edaya/core'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
} from '@edaya/dev-fixtures'

export type DevAuthLinkResult
  = | { status: 'skipped', reason: 'school-not-seeded' | 'already-linked', linkedStaff: number, linkedGuardians: number }
    | {
      status: 'seeded'
      linkedStaff: number
      linkedGuardians: number
      accounts: Array<{ email: string, kind: 'staff' | 'guardian', entityId: string }>
    }

export async function runDevAuthLink(
  application: SeedApplication,
  auth: AuthProvisioner,
): Promise<DevAuthLinkResult> {
  const school = await application.repositories.schools.findById(SEED_SCHOOL_ID)
  if (!school) {
    return { status: 'skipped', reason: 'school-not-seeded', linkedStaff: 0, linkedGuardians: 0 }
  }

  const actor = createBootstrapStaffActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId: 'dev-auth-link',
    staffMemberId: 'dev-auth-link',
  })
  const service = application.forActor(actor)
  const linkedAccounts: Array<{ email: string, kind: 'staff' | 'guardian', entityId: string }> = []
  let linkedStaff = 0
  let linkedGuardians = 0

  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const staff = await application.repositories.staffMembers.findById(account.staffId)
    if (!staff) {
      continue
    }

    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    }, { preserveSession: true })

    if (staff.subjectId === subjectId) {
      if (account.staffId === SEED_SCHOOL_OWNER_STAFF_ID && school.ownerSubjectId !== subjectId) {
        await service.updateSchoolConfiguration({
          schoolId: SEED_SCHOOL_ID,
          ownerSubjectId: subjectId,
        })
      }
      continue
    }

    await service.linkActorSubject({
      subjectId,
      staffMemberId: account.staffId,
    })

    if (account.staffId === SEED_SCHOOL_OWNER_STAFF_ID) {
      const currentSchool = await application.repositories.schools.findById(SEED_SCHOOL_ID)
      if (currentSchool && currentSchool.ownerSubjectId !== subjectId) {
        await service.updateSchoolConfiguration({
          schoolId: SEED_SCHOOL_ID,
          ownerSubjectId: subjectId,
        })
      }
    }

    linkedStaff++
    linkedAccounts.push({
      email: account.email,
      kind: 'staff',
      entityId: account.staffId,
    })
  }

  for (const account of DEV_AUTH_GUARDIAN_ACCOUNTS) {
    const guardian = await application.repositories.guardians.findById(account.guardianId)
    if (!guardian) {
      continue
    }

    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: DEV_AUTH_PASSWORD,
      name: account.name,
    }, { preserveSession: true })

    if (guardian.subjectId === subjectId) {
      continue
    }

    await service.linkActorSubject({
      subjectId,
      guardianId: account.guardianId,
    })

    linkedGuardians++
    linkedAccounts.push({
      email: account.email,
      kind: 'guardian',
      entityId: account.guardianId,
    })
  }

  if (linkedStaff === 0 && linkedGuardians === 0) {
    return { status: 'skipped', reason: 'already-linked', linkedStaff: 0, linkedGuardians: 0 }
  }

  return {
    status: 'seeded',
    linkedStaff,
    linkedGuardians,
    accounts: linkedAccounts,
  }
}
