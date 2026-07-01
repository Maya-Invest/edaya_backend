import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner } from '../support/types'
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

export interface DevStaffAuthSyncOptions {
  /** When false, only staff Better Auth accounts are provisioned (faster route tests). */
  linkGuardians?: boolean
}

/** Dev-only: assign school owner without owner-transfer service gate (bootstrap / seeding). */
export async function assignDevSchoolOwnerSubjectId(
  port: AuthLinkSeedPort,
  ownerSubjectId: string,
): Promise<void> {
  const currentSchool = await port.findSchoolById(SEED_SCHOOL_ID)
  if (!currentSchool || currentSchool.ownerSubjectId === ownerSubjectId) {
    return
  }

  await port.setSchoolOwnerSubjectId(currentSchool.id, ownerSubjectId)
}

async function ensureDevAuthStaffMembers(
  port: AuthLinkSeedPort,
): Promise<void> {
  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const seedMember = SEED_STAFF.find(member => member.id === account.staffId)
    if (!seedMember) {
      continue
    }

    const existingStaff = await port.findStaffById(account.staffId)
    if (existingStaff) {
      continue
    }

    const { firstName, lastName } = splitDisplayName(seedMember.name)
    await port.registerStaffMember({
      id: account.staffId,
      schoolId: SEED_SCHOOL_ID,
      firstName,
      lastName,
      email: account.email,
    })
  }
}

async function linkDevAuthStaffAndGuardians(
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
  options: DevStaffAuthSyncOptions = {},
): Promise<Pick<DevStaffAuthSyncResult, 'linkedStaff' | 'linkedGuardians'>> {
  const linkGuardians = options.linkGuardians ?? true
  let linkedStaff = 0
  let linkedGuardians = 0

  for (const account of DEV_AUTH_STAFF_ACCOUNTS) {
    const staff = await port.findStaffById(account.staffId)
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

    if (staff.subjectId) {
      await port.replaceStaffSubjectId(staff.id, subjectId)
      linkedStaff++
      continue
    }

    await port.linkActorSubject({
      subjectId,
      staffMemberId: account.staffId,
    })
    linkedStaff++
  }

  if (!linkGuardians) {
    return { linkedStaff, linkedGuardians }
  }

  for (const account of DEV_AUTH_GUARDIAN_ACCOUNTS) {
    const guardian = await port.findGuardianById(account.guardianId)
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
      await port.replaceGuardianSubjectId(guardian.id, subjectId)
      linkedGuardians++
      continue
    }

    await port.linkActorSubject({
      subjectId,
      guardianId: account.guardianId,
    })
    linkedGuardians++
  }

  return { linkedStaff, linkedGuardians }
}

export async function resolveDevSchoolOwnerSubjectId(
  port: AuthLinkSeedPort,
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

  const ownerStaff = await port.findStaffById(SEED_SCHOOL_OWNER_STAFF_ID)
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
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
  ownerSubjectId?: string,
  options: DevStaffAuthSyncOptions = {},
): Promise<DevStaffAuthSyncResult | null> {
  const school = await port.findSchoolById(SEED_SCHOOL_ID)
  if (!school) {
    return null
  }

  await ensureDevAuthStaffMembers(port)
  const { linkedStaff, linkedGuardians } = await linkDevAuthStaffAndGuardians(port, auth, options)

  const resolvedOwnerSubjectId = await resolveDevSchoolOwnerSubjectId(port, auth, ownerSubjectId)
  if (resolvedOwnerSubjectId) {
    await assignDevSchoolOwnerSubjectId(port, resolvedOwnerSubjectId)
  }

  return {
    linkedStaff,
    linkedGuardians,
    ...(resolvedOwnerSubjectId ? { ownerSubjectId: resolvedOwnerSubjectId } : {}),
  }
}
