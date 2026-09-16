import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { OnboardingStaffInviteRoleKey } from './staff-invite-roles'
import { randomUUID } from 'node:crypto'
import { AuthorizationError, AuthorizationErrorCode } from '@edaya/authorization'
import { AccountInvitationContactChannel, AccountInvitationKind, BusinessRuleViolationError, defaultScopesForProfileGrain, StaffMember } from '@edaya/core'
import { getStaffInvitePermissionPreset } from './default-access-roles'
import { ACCESS_ROLE_ID_BY_INVITE_ROLE, isOnboardingStaffInviteRoleKey } from './staff-invite-roles'
import { ensureSchoolPermissionProfiles, inviteRoleSourceKeys } from '../access-control/seed-staff-permission-profiles'

export interface InviteStaffMemberInput {
  email: string
  role: OnboardingStaffInviteRoleKey
}

export interface InviteStaffMembersInput {
  invites: InviteStaffMemberInput[]
}

export interface InviteStaffMembersOptions {
  inviteBaseUrl?: string
}

export interface InviteStaffMembersResult {
  invitedCount: number
  permissionAssignmentsEnsured: number
}

function parseInvites(input: InviteStaffMembersInput): InviteStaffMemberInput[] {
  const normalized: InviteStaffMemberInput[] = []
  const seenEmails = new Set<string>()

  for (const invite of input.invites) {
    const email = invite.email.trim().toLowerCase()
    if (!email) {
      continue
    }

    if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)) {
      throw new BusinessRuleViolationError(
        'STAFF_INVITE_INVALID_EMAIL',
        `Invalid email address: ${invite.email}`,
      )
    }

    if (!isOnboardingStaffInviteRoleKey(invite.role)) {
      throw new BusinessRuleViolationError(
        'STAFF_INVITE_INVALID_ROLE',
        `Invalid staff invite role: ${invite.role}`,
      )
    }

    if (seenEmails.has(email)) {
      throw new BusinessRuleViolationError(
        'STAFF_INVITE_DUPLICATE_EMAIL',
        `Duplicate invitation email: ${email}`,
      )
    }

    seenEmails.add(email)
    normalized.push({ email, role: invite.role })
  }

  return normalized
}

function namesFromInviteEmail(email: string): { firstName: string, lastName: string } {
  const local = email.split('@')[0] ?? 'invite'
  const parts = local.replace(/[._+-]+/g, ' ').split(/\s+/).filter(Boolean)

  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

  if (parts.length >= 2) {
    return {
      firstName: capitalize(parts[0]!),
      lastName: capitalize(parts.slice(1).join(' ')),
    }
  }

  return {
    firstName: capitalize(parts[0] ?? 'Invité'),
    lastName: '—',
  }
}

async function assertCanManageOnboardingInvites(
  application: OnboardingSchoolApplication,
  actor: Extract<ActorMetadata, { kind: 'staff' }>,
): Promise<void> {
  const staff = await application.repositories.staffMembers.findOne({
    subjectId: actor.subjectId,
    schoolId: actor.schoolId,
  })
  if (!staff?.isActive) {
    throw new AuthorizationError(
      AuthorizationErrorCode.Forbidden,
      'Active staff membership required to send onboarding invitations',
    )
  }

  const school = await application.repositories.schools.findById(actor.schoolId)
  if (school?.ownerSubjectId === actor.subjectId) {
    return
  }

  await application.forActor(actor).baseService.access.staffPermissions.assertAssign()
}

async function rejectOwnerEmailInvites(
  application: OnboardingSchoolApplication,
  schoolId: string,
  invites: InviteStaffMemberInput[],
  actor: Extract<ActorMetadata, { kind: 'staff' }>,
): Promise<void> {
  const blockedEmails = new Set<string>()

  const callerStaff = await application.repositories.staffMembers.findById(actor.staffMemberId)
  const callerEmail = callerStaff?.email?.trim().toLowerCase()
  if (callerEmail) {
    blockedEmails.add(callerEmail)
  }

  const school = await application.repositories.schools.findById(schoolId)
  if (school?.ownerSubjectId) {
    const ownerStaff = await application.repositories.staffMembers.findOne({
      subjectId: school.ownerSubjectId,
      schoolId,
    })
    const ownerEmail = ownerStaff?.email?.trim().toLowerCase()
    if (ownerEmail) {
      blockedEmails.add(ownerEmail)
    }
  }

  for (const invite of invites) {
    if (blockedEmails.has(invite.email)) {
      throw new BusinessRuleViolationError(
        'STAFF_INVITE_OWNER_EMAIL',
        'You cannot invite the school owner account',
      )
    }
  }
}

export async function inviteStaffMembers(
  application: OnboardingSchoolApplication,
  actor: ActorMetadata,
  input: InviteStaffMembersInput,
  options: InviteStaffMembersOptions = {},
): Promise<InviteStaffMembersResult> {
  const invites = parseInvites(input)
  if (!invites.length) {
    return { invitedCount: 0, permissionAssignmentsEnsured: 0 }
  }

  if (actor.kind !== 'staff') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Staff actor required')
  }

  await assertCanManageOnboardingInvites(application, actor)
  await rejectOwnerEmailInvites(application, actor.schoolId, invites, actor)

  if (!options.inviteBaseUrl) {
    throw new BusinessRuleViolationError(
      'INVITE_BASE_URL_MISSING',
      'Invitation links are not configured for this environment',
    )
  }

  const schoolId = actor.schoolId
  const service = application.forActor(actor)

  const academicYears = await application.repositories.academicYears.list({ schoolId })
  const academicYear = academicYears.find(year => year.status === 'published') ?? academicYears[0]

  let permissionAssignmentsEnsured = 0
  let invitedCount = 0

  await service.baseService.atomicExecution.execute(async () => {
    await ensureSchoolPermissionProfiles(application.repositories, schoolId)
    const schoolProfiles = await application.repositories.staffPermissionProfiles.list({ schoolId })
    const profilesBySourceKey = new Map(
      schoolProfiles.filter(profile => profile.sourceKey).map(profile => [profile.sourceKey!, profile]),
    )

    for (const invite of invites) {
      const { firstName, lastName } = namesFromInviteEmail(invite.email)
      const staffId = randomUUID()
      const preset = getStaffInvitePermissionPreset(ACCESS_ROLE_ID_BY_INVITE_ROLE[invite.role])
      if (!preset) {
        throw new BusinessRuleViolationError(
          'STAFF_INVITE_INVALID_ROLE',
          `No permission preset for invite role: ${invite.role}`,
        )
      }
      if (!academicYear) {
        throw new BusinessRuleViolationError(
          'STAFF_INVITE_ACADEMIC_YEAR_REQUIRED',
          'An active academic year is required before inviting staff',
        )
      }

      await service.baseService.entities.staffMembers.save(new StaffMember({
        id: staffId,
        schoolId,
        firstName,
        lastName,
        email: invite.email,
        isActive: true,
        accountKind: 'human',
        profileRole: invite.role,
      }))

      for (const sourceKey of inviteRoleSourceKeys(preset.id)) {
        const profile = profilesBySourceKey.get(sourceKey)
        if (!profile) {
          throw new BusinessRuleViolationError(
            'STAFF_INVITE_INVALID_ROLE',
            `No permission profile for invite role fragment: ${sourceKey}`,
          )
        }
        await service.accessControlWorkflow.applyStaffPermissionProfile({
          staffId,
          profileId: profile.id,
          academicYearId: academicYear.id,
          scopes: defaultScopesForProfileGrain(profile.scopeGrain),
        })
      }
      permissionAssignmentsEnsured += (await application.repositories.staffPermissionAssignments.list({ staffId })).length

      await service.accountInvitationWorkflow.sendAccountInvitation({
        kind: AccountInvitationKind.Staff,
        targetId: staffId,
        contactChannel: AccountInvitationContactChannel.Email,
        inviteBaseUrl: options.inviteBaseUrl!,
      })

      invitedCount += 1
    }
  })

  return { invitedCount, permissionAssignmentsEnsured }
}
