import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner } from '../support/types'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { splitDisplayName } from '@edaya/fixtures/shared/people'
import { SeedPortError } from '../support/seed-port-error'

export interface DevStaffAuthSyncResult {
  linkedStaff: number
  linkedTeachers: number
  linkedGuardians: number
  ownerSubjectId?: string
}

export interface DevStaffAuthSyncOptions {
  /** When false, only staff Better Auth accounts are provisioned (faster route tests). */
  linkGuardians?: boolean
}

/** Initialize the selected fixture owner through the adapter's admitted ownership operation. */
export async function assignDevSchoolOwnerSubjectId(
  port: AuthLinkSeedPort,
  ownerSubjectId: string,
  schoolId?: string,
): Promise<void> {
  const activeSchoolId = schoolId ?? resolveDevSeedContext().schoolId
  const currentSchool = await port.findSchoolById(activeSchoolId)
  if (!currentSchool || currentSchool.ownerSubjectId === ownerSubjectId) {
    return
  }
  if (currentSchool.ownerSubjectId)
    throw new SeedPortError('setSchoolOwnerSubjectId', { detail: 'Fixture initialization cannot replace the current school owner' })

  await port.setSchoolOwnerSubjectId(currentSchool.id, ownerSubjectId)
}

async function ensureDevAuthStaffMembers(
  port: AuthLinkSeedPort,
): Promise<void> {
  const context = resolveDevSeedContext()
  for (const account of context.staffAccounts) {
    const seedMember = context.dataset.entities.staffMembers?.find(member => member.id === account.staffId)
    if (!seedMember) {
      continue
    }

    const existingStaff = await port.findStaffById(account.staffId)
    if (existingStaff) {
      continue
    }

    const { firstName, lastName } = splitDisplayName(`${seedMember.firstName} ${seedMember.lastName}`)
    await port.registerStaffMember({
      id: account.staffId,
      schoolId: context.schoolId,
      firstName,
      lastName,
      email: account.email,
      profileRole: seedMember.profileRole ?? undefined,
    })
  }
}

async function linkDevAuthTeachers(
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
): Promise<number> {
  const context = resolveDevSeedContext()
  let linkedTeachers = 0

  for (const account of context.teacherAccounts) {
    const teacher = await port.findTeacherById(account.teacherId)
    if (!teacher) {
      continue
    }

    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: context.authPassword,
      name: account.name,
    }, { preserveSession: true })

    if (teacher.subjectId === subjectId) {
      continue
    }

    await port.linkActorSubject({
      subjectId,
      teacherId: account.teacherId,
    })
    linkedTeachers++
  }

  return linkedTeachers
}

async function linkDevAuthStaffAndGuardians(
  port: AuthLinkSeedPort,
  auth: AuthProvisioner,
  options: DevStaffAuthSyncOptions = {},
): Promise<Pick<DevStaffAuthSyncResult, 'linkedStaff' | 'linkedGuardians'>> {
  const context = resolveDevSeedContext()
  const linkGuardians = options.linkGuardians ?? true
  let linkedStaff = 0
  let linkedGuardians = 0

  for (const account of context.staffAccounts) {
    const staff = await port.findStaffById(account.staffId)
    if (!staff) {
      continue
    }

    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: context.authPassword,
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

  for (const account of context.guardianAccounts) {
    const guardian = await port.findGuardianById(account.guardianId)
    if (!guardian) {
      continue
    }

    const { subjectId } = await auth.ensureUser({
      email: account.email,
      password: context.authPassword,
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
  const context = resolveDevSeedContext()
  if (ownerSubjectId) {
    return ownerSubjectId
  }

  const ownerAccount = context.staffAccounts.find(
    account => account.staffId === context.ownerStaffId,
  )
  if (!ownerAccount) {
    return undefined
  }

  const fromAuth = await auth.lookupSubjectIdByEmail(ownerAccount.email, context.authPassword)
  if (fromAuth) {
    return fromAuth
  }

  const ownerStaff = await port.findStaffById(context.ownerStaffId)
  return ownerStaff?.subjectId
}

export function ownerSubjectIdFromAuthProvision(
  provision: { accounts: Array<{ email: string, subjectId: string }> },
): string | undefined {
  const context = resolveDevSeedContext()
  const ownerEmail = context.staffAccounts.find(
    account => account.staffId === context.ownerStaffId,
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
  const context = resolveDevSeedContext()
  const school = await port.findSchoolById(context.schoolId)
  if (!school) {
    return null
  }

  await ensureDevAuthStaffMembers(port)
  const { linkedStaff, linkedGuardians } = await linkDevAuthStaffAndGuardians(port, auth, options)
  const linkedTeachers = await linkDevAuthTeachers(port, auth)

  const resolvedOwnerSubjectId = await resolveDevSchoolOwnerSubjectId(port, auth, ownerSubjectId)
  if (resolvedOwnerSubjectId) {
    await assignDevSchoolOwnerSubjectId(port, resolvedOwnerSubjectId, context.schoolId)
  }

  return {
    linkedStaff,
    linkedTeachers,
    linkedGuardians,
    ...(resolvedOwnerSubjectId ? { ownerSubjectId: resolvedOwnerSubjectId } : {}),
  }
}
