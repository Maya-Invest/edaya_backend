import type { Guardian as GuardianEntity, StaffMember as StaffMemberEntity } from '@edaya/core'
import type { AuthProvisioner, SeedApplication } from './types'
import {
  createBootstrapStaffActorMetadata,
  Guardian,
  School,
  StaffMember,
} from '@edaya/core'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
} from '@edaya/dev-fixtures'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'

export type DevAuthLinkResult
  = | { status: 'skipped', reason: 'school-not-seeded' | 'already-linked', linkedStaff: number, linkedGuardians: number }
  | {
    status: 'seeded'
    linkedStaff: number
    linkedGuardians: number
    accounts: Array<{ email: string, kind: 'staff' | 'guardian', entityId: string }>
  }

async function relinkStaffSubject(
  application: SeedApplication,
  staff: StaffMemberEntity,
  subjectId: string,
): Promise<void> {
  await application.repositories.staffMembers.save(new StaffMember({
    id: staff.id,
    schoolId: staff.schoolId,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    subjectId,
    accountKind: staff.accountKind,
    ...(staff.serviceId ? { serviceId: staff.serviceId } : {}),
    ...(staff.createdBySubjectId ? { createdBySubjectId: staff.createdBySubjectId } : {}),
    serviceElevated: staff.serviceElevated,
    isActive: staff.isActive,
    createdAt: staff.createdAt,
  }))
}

async function relinkGuardianSubject(
  application: SeedApplication,
  guardian: GuardianEntity,
  subjectId: string,
): Promise<void> {
  await application.repositories.guardians.save(new Guardian({
    id: guardian.id,
    schoolId: guardian.schoolId,
    firstName: guardian.firstName,
    lastName: guardian.lastName,
    email: guardian.email,
    phone: guardian.phone,
    subjectId,
    hasAccess: guardian.hasAccess,
    premiumNotificationsEnabled: guardian.premiumNotificationsEnabled,
    createdAt: guardian.createdAt,
  }))
}

async function ensureOwnerSubjectId(
  application: SeedApplication,
  staffId: string,
  subjectId: string,
): Promise<void> {
  if (staffId !== SEED_SCHOOL_OWNER_STAFF_ID) {
    return
  }

  const currentSchool = await application.repositories.schools.findById(SEED_SCHOOL_ID)
  if (!currentSchool || currentSchool.ownerSubjectId === subjectId) {
    return
  }

  await application.repositories.schools.save(new School({
    id: currentSchool.id,
    name: currentSchool.name,
    timeZone: currentSchool.timeZone,
    ownerSubjectId: subjectId,
    ...(currentSchool.type ? { type: currentSchool.type } : {}),
    ...(currentSchool.country ? { country: currentSchool.country } : {}),
    ...(currentSchool.city ? { city: currentSchool.city } : {}),
    createdAt: currentSchool.createdAt,
  }))
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
      await ensureOwnerSubjectId(application, account.staffId, subjectId)
      continue
    }

    if (staff.subjectId) {
      await relinkStaffSubject(application, staff, subjectId)
    }
    else {
      await service.linkActorSubject({
        subjectId,
        staffMemberId: account.staffId,
      })
    }

    await ensureOwnerSubjectId(application, account.staffId, subjectId)

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

    if (guardian.subjectId) {
      await relinkGuardianSubject(application, guardian, subjectId)
    }
    else {
      await service.linkActorSubject({
        subjectId,
        guardianId: account.guardianId,
      })
    }

    linkedGuardians++
    linkedAccounts.push({
      email: account.email,
      kind: 'guardian',
      entityId: account.guardianId,
    })
  }

  if (linkedStaff === 0 && linkedGuardians === 0) {
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
