import type { AccountInvitationRepository, Guardian, StaffMember, Student, Teacher } from '@edaya/core'
import type { LinkSubjectToActorResult } from '../account-linking/link-subject-to-actor'
import type { BaseSchoolService } from '../base-school-service'
import type { InvitationWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { randomUUID } from 'node:crypto'
import { denyResourceAccess } from '@edaya/authorization'
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, BusinessRuleViolationError, School as SchoolEntity, withShortName } from '@edaya/core'
import { ACCOUNT_INVITATION_TTL_MS } from '../../capabilities/invitations/constants'
import { invitationLifecycleLockKey } from '../../capabilities/invitations/invitation-lifecycle'
import { buildInvitationUrl, generateInvitationToken, hashInvitationToken } from '../../capabilities/invitations/invitation-token'
import { normalizeInvitationEmail, normalizeInvitationPhone, resolveInvitationContact, resolveInviteeDisplayName, resolveStudentInvitationContact } from '../../capabilities/invitations/resolve-invitation-contact'
import { renderInvitationContent } from '../../capabilities/notifications/templates/render-enqueue-content'
import { resolveSchoolName } from '../../capabilities/notifications/templates/resolve-school-name'
import { linkSubjectToActor } from '../account-linking/link-subject-to-actor'

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface SendAccountInvitationInput {
  kind: AccountInvitationKind
  targetId: string
  contactChannel?: AccountInvitationContactChannel
  contactValue?: string
  inviteBaseUrl: string
}

export interface SendAccountInvitationResult {
  invitation: AccountInvitation
  token: string
}

export interface ResendAccountInvitationInput {
  invitationId: string
  inviteBaseUrl: string
}

export interface RevokeAccountInvitationInput {
  invitationId: string
}

export interface AcceptAccountInvitationInput {
  token: string
  subjectId: string
  contactValue?: string
}

export interface AcceptAccountInvitationByIdInput {
  invitationId: string
  subjectId: string
  contactValue?: string
}

export type AcceptAccountInvitationResult = LinkSubjectToActorResult

export class AccountInvitationServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: InvitationWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('invitations', base.repositories)
  }

  async sendAccountInvitation(input: SendAccountInvitationInput): Promise<SendAccountInvitationResult> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      return this.createAndDeliverInvitation(input)
    }, { lockKeys: [this.invitationLockKey(input.kind, input.targetId)] })
  }

  async resendAccountInvitation(input: ResendAccountInvitationInput): Promise<SendAccountInvitationResult> {
    const existing = await this.requireInvitationInSchool(input.invitationId)
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const current = await this.requireInvitationInSchool(input.invitationId)
      if (current.status === AccountInvitationStatus.Accepted) {
        throw new BusinessRuleViolationError(
          'INVITATION_ALREADY_ACCEPTED',
          'This invitation has already been accepted',
        )
      }
      await this.revokeInvitationDelivery(current)
      if (current.status !== AccountInvitationStatus.Revoked) {
        await this.transitionInvitation(current, current.copyWith({
          status: AccountInvitationStatus.Revoked,
        }))
      }
      return this.createAndDeliverInvitation({
        kind: current.kind,
        targetId: current.targetId,
        contactChannel: current.contactChannel,
        contactValue: current.contactValue,
        inviteBaseUrl: input.inviteBaseUrl,
      })
    }, { lockKeys: [this.invitationLockKey(existing.kind, existing.targetId)] })
  }

  async revokeAccountInvitation(input: RevokeAccountInvitationInput): Promise<AccountInvitation> {
    const existing = await this.requireInvitationInSchool(input.invitationId)
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const current = await this.requireInvitationInSchool(input.invitationId)
      if (current.status === AccountInvitationStatus.Accepted) {
        throw new BusinessRuleViolationError(
          'INVITATION_ALREADY_ACCEPTED',
          'Accepted invitations cannot be revoked',
        )
      }
      if (current.status === AccountInvitationStatus.Revoked) {
        return current
      }
      await this.revokeInvitationDelivery(current)
      const revoked = current.copyWith({ status: AccountInvitationStatus.Revoked })
      await this.transitionInvitation(current, revoked)
      return revoked
    }, { lockKeys: [this.invitationLockKey(existing.kind, existing.targetId)] })
  }

  async acceptAccountInvitation(input: AcceptAccountInvitationInput): Promise<AcceptAccountInvitationResult> {
    const preview = await this.repositories.accountInvitations.findByTokenHash(hashInvitationToken(input.token))
    if (!preview) {
      throw new BusinessRuleViolationError('INVITATION_NOT_FOUND', 'Invitation not found or invalid')
    }
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.invitations.assertAccept()
      const invitation = await this.requireValidInvitationToken(input.token)
      return this.completeAccept(invitation, input.subjectId, input.contactValue)
    }, { lockKeys: [invitationLifecycleLockKey(preview.schoolId, preview.kind, preview.targetId)] })
  }

  async acceptAccountInvitationById(
    input: AcceptAccountInvitationByIdInput,
  ): Promise<AcceptAccountInvitationResult> {
    const preview = await this.repositories.accountInvitations.findById(input.invitationId)
    if (!preview) {
      throw new BusinessRuleViolationError('INVITATION_NOT_FOUND', 'Invitation not found or invalid')
    }
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.invitations.assertAccept()
      const invitation = await this.requireValidInvitationId(input.invitationId)
      return this.completeAccept(invitation, input.subjectId, input.contactValue)
    }, { lockKeys: [invitationLifecycleLockKey(preview.schoolId, preview.kind, preview.targetId)] })
  }

  async getInvitationPreviewByToken(token: string): Promise<AccountInvitation> {
    return this.requireValidInvitationToken(token)
  }

  private invitationLockKey(kind: AccountInvitationKind, targetId: string): string {
    return invitationLifecycleLockKey(this.baseService.actor.schoolId, kind, targetId)
  }

  private async saveInvitation(invitation: AccountInvitation): Promise<void> {
    const existing = await this.repositories.accountInvitations.forSchool!(this.baseService.actor.schoolId).findById(invitation.id)
    const scope = await this.baseService.access.invitations.assertSave(invitation, existing)
    await this.repositories.accountInvitations.forAccess(scope).save(invitation)
  }

  private async transitionInvitation(
    current: AccountInvitation,
    next: AccountInvitation,
  ): Promise<void> {
    const existing = await this.repositories.accountInvitations.forSchool!(this.baseService.actor.schoolId).findById(current.id)
    const scope = await this.baseService.access.invitations.assertSave(next, existing ?? current)
    const store = this.repositories.accountInvitations.forAccess(scope) as AccountInvitationRepository
    const updated = await store.compareAndSetStatus(current.id, current.status, next)
    if (!updated) {
      throw new BusinessRuleViolationError(
        'INVITATION_STALE_TRANSITION',
        'Invitation was changed by another request',
      )
    }
  }

  private async createAndDeliverInvitation(
    input: SendAccountInvitationInput,
  ): Promise<SendAccountInvitationResult> {
    const channel = input.contactChannel ?? AccountInvitationContactChannel.Email
    if (channel === AccountInvitationContactChannel.Phone) {
      throw new BusinessRuleViolationError(
        'INVITATION_PHONE_UNSUPPORTED',
        'Phone invitations are not available until phone authentication ships',
      )
    }
    const { displayName, contactValue } = await this.resolveTargetContact(input, channel)

    const pending = await this.repositories.accountInvitations.findPendingByTarget(
      this.baseService.actor.schoolId,
      input.kind,
      input.targetId,
    )
    if (pending) {
      await this.revokeInvitationDelivery(pending)
      await this.transitionInvitation(pending, pending.copyWith({
        status: AccountInvitationStatus.Revoked,
      }))
    }

    const token = generateInvitationToken()
    const tokenHash = hashInvitationToken(token)
    const now = new Date()
    const invitation = new AccountInvitation({
      id: randomUUID(),
      schoolId: this.baseService.actor.schoolId,
      kind: input.kind,
      targetId: input.targetId,
      contactChannel: channel,
      contactValue,
      tokenHash,
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date(now.getTime() + ACCOUNT_INVITATION_TTL_MS),
      createdByStaffId: this.requireStaffActorId(),
      createdAt: now,
      lastSentAt: now,
    })

    await this.saveInvitation(invitation)

    const schoolName = await resolveSchoolName(this.repositories, invitation.schoolId)
    const inviteUrl = buildInvitationUrl(input.inviteBaseUrl, token)
    const { emailSubject, emailBody } = await renderInvitationContent(
      this.baseService.templateService,
      {
        schoolId: invitation.schoolId,
        variables: {
          schoolName,
          inviteeName: displayName,
          inviteUrl,
          expiresAt: invitation.expiresAt.toISOString(),
          actorKind: invitation.kind,
        },
      },
    )

    await this.baseService.invitationDelivery.deliver({
      invitationId: invitation.id,
      schoolId: invitation.schoolId,
      contactChannel: invitation.contactChannel,
      contactValue: invitation.contactValue,
      displayName,
      actorKind: invitation.kind,
      inviteUrl,
      expiresAt: invitation.expiresAt,
      emailSubject,
      emailBody,
    })

    return { invitation, token }
  }

  private async resolveTargetContact(
    input: SendAccountInvitationInput,
    channel: AccountInvitationContactChannel,
  ): Promise<{ displayName: string, contactValue: string }> {
    if (input.kind === AccountInvitationKind.Staff) {
      const staff = await this.requireUnlinkedStaff(input.targetId)
      return this.requireEmailOrRejectPhone(
        resolveInvitationContact(channel, input.contactValue, staff),
        resolveInvitationContact(AccountInvitationContactChannel.Phone, input.contactValue, staff),
        displayNameFor(staff),
      )
    }

    if (input.kind === AccountInvitationKind.Guardian) {
      const guardian = await this.requireUnlinkedGuardian(input.targetId)
      return this.requireEmailOrRejectPhone(
        resolveInvitationContact(channel, input.contactValue, undefined, guardian),
        resolveInvitationContact(AccountInvitationContactChannel.Phone, input.contactValue, undefined, guardian),
        displayNameFor(guardian),
      )
    }

    if (input.kind === AccountInvitationKind.Teacher) {
      const teacher = await this.requireUnlinkedTeacher(input.targetId)
      return this.requireEmailOrRejectPhone(
        resolveInvitationContact(channel, input.contactValue, undefined, undefined, teacher),
        resolveInvitationContact(AccountInvitationContactChannel.Phone, input.contactValue, undefined, undefined, teacher),
        displayNameFor(teacher),
      )
    }

    const student = await this.requireUnlinkedStudent(input.targetId)
    return this.requireEmailOrRejectPhone(
      resolveStudentInvitationContact(channel, input.contactValue),
      resolveStudentInvitationContact(AccountInvitationContactChannel.Phone, input.contactValue),
      displayNameFor(student),
    )
  }

  private requireEmailOrRejectPhone(
    email: string | undefined,
    phone: string | undefined,
    displayName: string,
  ): { displayName: string, contactValue: string } {
    if (email) {
      return { displayName, contactValue: email }
    }
    if (phone) {
      throw new BusinessRuleViolationError(
        'INVITATION_PHONE_UNSUPPORTED',
        'Phone invitations are not available until phone authentication ships',
      )
    }
    throw new BusinessRuleViolationError(
      'INVITATION_CONTACT_REQUIRED',
      'A deliverable contact is required to send an invitation',
    )
  }

  private async completeAccept(
    invitation: AccountInvitation,
    subjectId: string,
    contactValue: string | undefined,
  ): Promise<AcceptAccountInvitationResult> {
    this.assertContactMatches(invitation, contactValue)

    if (invitation.status === AccountInvitationStatus.Accepted) {
      if (invitation.acceptedSubjectId === subjectId) {
        return this.loadLinkedEntity(invitation)
      }
      throw new BusinessRuleViolationError(
        'INVITATION_ALREADY_ACCEPTED',
        'This invitation was already used by another account',
      )
    }

    await this.assertInvitationTargetLinkable(invitation, subjectId)

    const result = await linkSubjectToActor(
      this.baseService,
      this.repositories,
      invitation.schoolId,
      this.buildLinkInput(invitation, subjectId),
    )

    await this.assignPendingOwnerIfNeeded(invitation, subjectId)

    await this.baseService.invitationDelivery.revoke(invitation.id, invitation.schoolId)

    await this.transitionInvitation(invitation, invitation.copyWith({
      status: AccountInvitationStatus.Accepted,
      acceptedAt: new Date(),
      acceptedSubjectId: subjectId,
    }))

    return result
  }

  private async requireValidInvitationToken(token: string): Promise<AccountInvitation> {
    const invitation = await this.repositories.accountInvitations.findByTokenHash(hashInvitationToken(token))
    if (!invitation) {
      throw new BusinessRuleViolationError('INVITATION_NOT_FOUND', 'Invitation not found or invalid')
    }
    return this.requireUsableInvitation(invitation)
  }

  private async requireValidInvitationId(invitationId: string): Promise<AccountInvitation> {
    const invitation = await this.repositories.accountInvitations.findById(invitationId)
    if (!invitation) {
      throw new BusinessRuleViolationError('INVITATION_NOT_FOUND', 'Invitation not found or invalid')
    }
    return this.requireUsableInvitation(invitation)
  }

  private async requireUsableInvitation(invitation: AccountInvitation): Promise<AccountInvitation> {
    await this.baseService.access.invitations.assertUse(invitation.id)
    if (invitation.status === AccountInvitationStatus.Revoked) {
      throw new BusinessRuleViolationError('INVITATION_REVOKED', 'This invitation has been revoked')
    }
    if (invitation.status === AccountInvitationStatus.Expired
      || (invitation.status === AccountInvitationStatus.Pending && invitation.expiresAt <= new Date())) {
      throw new BusinessRuleViolationError('INVITATION_EXPIRED', 'This invitation has expired')
    }
    return invitation
  }

  private assertContactMatches(invitation: AccountInvitation, contactValue: string | undefined): void {
    const email = invitation.contactChannel === AccountInvitationContactChannel.Email
    const expected = email
      ? normalizeInvitationEmail(invitation.contactValue)
      : normalizeInvitationPhone(invitation.contactValue)
    const actual = email
      ? normalizeInvitationEmail(contactValue)
      : normalizeInvitationPhone(contactValue)
    if (!expected || !actual || expected !== actual) {
      throw new BusinessRuleViolationError(
        email ? 'INVITATION_EMAIL_MISMATCH' : 'INVITATION_PHONE_MISMATCH',
        `Signed-in ${email ? 'email' : 'phone'} does not match the invitation contact`,
      )
    }
  }

  private buildLinkInput(invitation: AccountInvitation, subjectId: string) {
    if (invitation.kind === AccountInvitationKind.Staff) {
      return { subjectId, staffMemberId: invitation.targetId }
    }
    if (invitation.kind === AccountInvitationKind.Guardian) {
      return { subjectId, guardianId: invitation.targetId }
    }
    if (invitation.kind === AccountInvitationKind.Teacher) {
      return { subjectId, teacherId: invitation.targetId }
    }
    return { subjectId, studentId: invitation.targetId }
  }

  private async loadLinkedEntity(invitation: AccountInvitation): Promise<AcceptAccountInvitationResult> {
    if (invitation.kind === AccountInvitationKind.Staff) {
      const staff = await this.repositories.staffMembers.findById(invitation.targetId)
      if (!staff) {
        throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Staff member not found')
      }
      return { kind: 'staff', entity: staff }
    }
    if (invitation.kind === AccountInvitationKind.Guardian) {
      const guardian = await this.repositories.guardians.findById(invitation.targetId)
      if (!guardian) {
        throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Guardian not found')
      }
      return { kind: 'guardian', entity: guardian }
    }
    if (invitation.kind === AccountInvitationKind.Teacher) {
      const teacher = await this.repositories.teachers.findById(invitation.targetId)
      if (!teacher) {
        throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Teacher not found')
      }
      return { kind: 'teacher', entity: teacher }
    }
    const student = await this.repositories.students.findById(invitation.targetId)
    if (!student) {
      throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Student not found')
    }
    return { kind: 'student', entity: student }
  }

  private async revokeInvitationDelivery(invitation: AccountInvitation): Promise<void> {
    await this.baseService.invitationDelivery.revoke(invitation.id, invitation.schoolId)
  }

  private async assertInvitationTargetLinkable(
    invitation: AccountInvitation,
    subjectId: string,
  ): Promise<void> {
    let existingSubjectId: string | undefined
    if (invitation.kind === AccountInvitationKind.Staff) {
      existingSubjectId = (await this.repositories.staffMembers.findById(invitation.targetId))?.subjectId
    }
    else if (invitation.kind === AccountInvitationKind.Guardian) {
      existingSubjectId = (await this.repositories.guardians.findById(invitation.targetId))?.subjectId
    }
    else if (invitation.kind === AccountInvitationKind.Teacher) {
      existingSubjectId = (await this.repositories.teachers.findById(invitation.targetId))?.subjectId
    }
    else {
      existingSubjectId = (await this.repositories.students.findById(invitation.targetId))?.subjectId
    }

    if (existingSubjectId && existingSubjectId !== subjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_SUBJECT_ALREADY_LINKED',
        'The invitation target is already linked to a different account',
      )
    }
  }

  private async assignPendingOwnerIfNeeded(
    invitation: AccountInvitation,
    subjectId: string,
  ): Promise<void> {
    if (invitation.kind !== AccountInvitationKind.Staff) {
      return
    }
    const school = await this.repositories.schools.findById(invitation.schoolId)
    if (!school || school.pendingOwnerStaffId !== invitation.targetId) {
      return
    }
    const updated = new SchoolEntity(withShortName({
      ...school.data,
      ownerSubjectId: subjectId,
      pendingOwnerStaffId: null,
    }))
    const scope = await this.baseService.access.identities.assertClaimOwner(invitation, school, updated)
    await this.repositories.schools.forAccess(scope).save(updated)
  }

  private requireStaffActorId(): string {
    if (this.baseService.actor.kind !== 'staff') {
      denyResourceAccess()
    }
    return this.baseService.actor.staffMemberId
  }

  private async requireInvitationInSchool(invitationId: string): Promise<AccountInvitation> {
    const invitation = await this.repositories.accountInvitations.findById(invitationId)
    if (!invitation || invitation.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return invitation
  }

  private async requireUnlinkedStaff(staffMemberId: string): Promise<StaffMember> {
    const staff = await this.requireStaffMemberInSchool(staffMemberId)
    if (staff.subjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_ALREADY_LINKED',
        'This staff member is already linked to an auth account',
      )
    }
    return staff
  }

  private async requireUnlinkedGuardian(guardianId: string): Promise<Guardian> {
    const guardian = await this.requireGuardianInSchool(guardianId)
    if (guardian.subjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_ALREADY_LINKED',
        'This guardian is already linked to an auth account',
      )
    }
    return guardian
  }

  private async requireUnlinkedStudent(studentId: string): Promise<Student> {
    const student = await this.requireStudentInSchool(studentId)
    if (student.subjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_ALREADY_LINKED',
        'This student is already linked to an auth account',
      )
    }
    return student
  }

  private async requireUnlinkedTeacher(teacherId: string): Promise<Teacher> {
    const teacher = await this.requireTeacherInSchool(teacherId)
    if (teacher.subjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_ALREADY_LINKED',
        'This teacher is already linked to an auth account',
      )
    }
    return teacher
  }

  private async requireStaffMemberInSchool(staffMemberId: string): Promise<StaffMember> {
    const staffMember = await this.repositories.staffMembers.findById(staffMemberId)
    if (!staffMember || staffMember.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return staffMember
  }

  private async requireGuardianInSchool(guardianId: string): Promise<Guardian> {
    const guardian = await this.repositories.guardians.findById(guardianId)
    if (!guardian || guardian.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return guardian
  }

  private async requireStudentInSchool(studentId: string): Promise<Student> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return student
  }

  private async requireTeacherInSchool(teacherId: string): Promise<Teacher> {
    const teacher = await this.repositories.teachers.findById(teacherId)
    if (!teacher || teacher.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return teacher
  }
}

function displayNameFor(entity: StaffMember | Guardian | Student | Teacher): string {
  return resolveInviteeDisplayName(entity)
}
