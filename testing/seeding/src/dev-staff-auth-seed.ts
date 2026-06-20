import type { AuthProvisioner, SeedApplication } from './types'
import { createBootstrapStaffActorMetadata, School } from '@edaya/core'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
  SEED_STAFF,
  splitDisplayName,
} from '@edaya/dev-fixtures'

export interface DevStaffAuthSyncResult {
  linkedStaff: number
  linkedGuardians: number
  ownerSubjectId?: string
}

/** Dev-only: assign school owner without owner-transfer service gate (bootstrap / seeding). */
export async function assignDevSchoolOwnerSubjectId(
  application: SeedApplication,
  ownerSubjectId: string,
): Promise<void> {
  const currentSchool = await application.repositories.schools.findById(SEED_SCHOOL_ID)
  if (!currentSchool || currentSchool.ownerSubjectId === ownerSubjectId) {
    return
  }

  await application.repositories.schools.save(new School({
    id: currentSchool.id,
    name: currentSchool.name,
    timeZone: currentSchool.timeZone,
    ownerSubjectId,
    type: currentSchool.type,
    country: currentSchool.country,
    city: currentSchool.city,
    createdAt: currentSchool.createdAt,
  }))
}

async function ensureDevAuthStaffMembers(
  application: SeedApplication,
  service: ReturnType<SeedApplication['forActor']>,
): Promise<void> {
  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const seedMember = SEED_STAFF.find(member => member.id === account.staffId)
    if (!seedMember) {
      continue
    }

    const existingStaff = await application.repositories.staffMembers.findById(account.staffId)
    if (existingStaff) {
      continue
    }

    const { firstName, lastName } = splitDisplayName(seedMember.name)
    await service.registerStaffMember({
      id: account.staffId,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: account.email,
    })
  }
}

async function linkDevAuthStaffAndGuardians(
  application: SeedApplication,
  auth: AuthProvisioner,
  service: ReturnType<SeedApplication['forActor']>,
): Promise<Pick<DevStaffAuthSyncResult, 'linkedStaff' | 'linkedGuardians'>> {
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
      continue
    }

    await service.linkActorSubject({
      subjectId,
      staffMemberId: account.staffId,
    })
    linkedStaff++
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
  }

  return { linkedStaff, linkedGuardians }
}

export async function resolveDevSchoolOwnerSubjectId(
  application: SeedApplication,
  auth: AuthProvisioner,
  ownerSubjectId?: string,
): Promise<string | undefined> {
  if (ownerSubjectId) {
    return ownerSubjectId
  }

  const ownerAccount = DEV_AUTH_STAFF_ACCOUNTS.find(
    account => account.staffId === SEED_SCHOOL_OWNER_STAFF_ID,
  )
  if (!ownerAccount) {
    return undefined
  }

  const fromAuth = await auth.lookupSubjectIdByEmail(ownerAccount.email, DEV_AUTH_PASSWORD)
  if (fromAuth) {
    return fromAuth
  }

  const ownerStaff = await application.repositories.staffMembers.findById(SEED_SCHOOL_OWNER_STAFF_ID)
  return ownerStaff?.subjectId
}

export function ownerSubjectIdFromAuthProvision(
  provision: { accounts: Array<{ email: string, subjectId: string }> },
): string | undefined {
  const ownerEmail = DEV_AUTH_STAFF_ACCOUNTS.find(
    account => account.staffId === SEED_SCHOOL_OWNER_STAFF_ID,
  )?.email
  if (!ownerEmail) {
    return undefined
  }
  return provision.accounts.find(account => account.email === ownerEmail)?.subjectId
}

/**
 * Ensure dev auth staff exist, link Better Auth users, and assign Koussi Yann as school owner.
 * Idempotent — safe to run from school seed and access seed.
 */
export async function syncDevStaffAuthAndOwner(
  application: SeedApplication,
  auth: AuthProvisioner,
  ownerSubjectId?: string,
): Promise<DevStaffAuthSyncResult | null> {
  const school = await application.repositories.schools.findById(SEED_SCHOOL_ID)
  if (!school) {
    return null
  }

  const actor = createBootstrapStaffActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId: 'dev-staff-auth-seed',
    staffMemberId: 'dev-staff-auth-seed',
  })
  const service = application.forActor(actor)

  await ensureDevAuthStaffMembers(application, service)
  const { linkedStaff, linkedGuardians } = await linkDevAuthStaffAndGuardians(application, auth, service)

  const resolvedOwnerSubjectId = await resolveDevSchoolOwnerSubjectId(application, auth, ownerSubjectId)
  if (resolvedOwnerSubjectId) {
    await assignDevSchoolOwnerSubjectId(application, resolvedOwnerSubjectId)
  }

  return {
    linkedStaff,
    linkedGuardians,
    ...(resolvedOwnerSubjectId ? { ownerSubjectId: resolvedOwnerSubjectId } : {}),
  }
}
