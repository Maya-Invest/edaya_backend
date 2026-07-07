import type { Guardian, StaffMember, Student, Teacher } from '../../domain'
import type { LinkSubjectToActorResult } from '../account-linking/link-subject-to-actor'
import type { BaseSchoolService } from '../base-school-service'
import type { InvitationWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { randomUUID } from 'node:crypto'
import { operationModule } from '../../application/entities/entity-config'
import { AccessControlOperations, denyResourceAccess } from '../../capabilities/authorization'
import { ACCOUNT_INVITATION_TTL_MS } from '../../capabilities/invitations/constants'
import {
  buildInvitationUrl,
  generateInvitationToken,
  hashInvitationToken,
} from '../../capabilities/invitations/invitation-token'
import {
  normalizeInvitationEmail,
  resolveInvitationContact,
  resolveInviteeDisplayName,
  resolveStudentInvitationEmail,
} from '../../capabilities/invitations/resolve-invitation-contact'
import { ACCOUNT_INVITATION_TEMPLATE_KEY } from '../../capabilities/notifications/templates/keys'
import { renderInvitationEmailContent } from '../../capabilities/notifications/templates/render-enqueue-content'
import { resolveSchoolName } from '../../capabilities/notifications/templates/resolve-school-name'
import {
  AccountInvitation,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AccountInvitationStatus,
} from '../../domain/access/account-invitation'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
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
  contactEmail: string
}

export type AcceptAccountInvitationResult = LinkSubjectToActorResult

export class AccountInvitationServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: InvitationWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('invitations', base.repositories)
  }

  async sendAccountInvitation(input: SendAccountInvitationInput): Promise<SendAccountInvitationResult> {
    await operationModule(AccessControlOperations.assign)(this.baseService.actor)
    return this.createAndDeliverInvitation(input)
  }

  async resendAccountInvitation(input: ResendAccountInvitationInput): Promise<SendAccountInvitationResult> {
    await operationModule(AccessControlOperations.assign)(this.baseService.actor)
    const existing = await this.requireInvitationInSchool(input.invitationId)
    if (existing.status === AccountInvitationStatus.Accepted) {
      throw new BusinessRuleViolationError(
        'INVITATION_ALREADY_ACCEPTED',
        'This invitation has already been accepted',
      )
    }
    await this.revokeInvitationDelivery(existing)
    if (existing.status !== AccountInvitationStatus.Revoked) {
      await this.repositories.accountInvitations.save(existing.copyWith({
        status: AccountInvitationStatus.Revoked,
      }))
    }
    return this.createAndDeliverInvitation({
      kind: existing.kind,
      targetId: existing.targetId,
      contactChannel: existing.contactChannel,
      contactValue: existing.contactValue,
      inviteBaseUrl: input.inviteBaseUrl,
    })
  }

  async revokeAccountInvitation(input: RevokeAccountInvitationInput): Promise<AccountInvitation> {
    await operationModule(AccessControlOperations.assign)(this.baseService.actor)
    const existing = await this.requireInvitationInSchool(input.invitationId)
    if (existing.status === AccountInvitationStatus.Accepted) {
      throw new BusinessRuleViolationError(
        'INVITATION_ALREADY_ACCEPTED',
        'Accepted invitations cannot be revoked',
      )
    }
    await this.revokeInvitationDelivery(existing)
    const revoked = existing.copyWith({ status: AccountInvitationStatus.Revoked })
    await this.repositories.accountInvitations.save(revoked)
    return revoked
  }

  async acceptAccountInvitation(input: AcceptAccountInvitationInput): Promise<AcceptAccountInvitationResult> {
    const invitation = await this.requireValidInvitationToken(input.token)
    this.assertContactEmailMatches(invitation, input.contactEmail)

    if (invitation.status === AccountInvitationStatus.Accepted) {
      if (invitation.acceptedSubjectId === input.subjectId) {
        return this.loadLinkedEntity(invitation)
      }
      throw new BusinessRuleViolationError(
        'INVITATION_ALREADY_ACCEPTED',
        'This invitation was already used by another account',
      )
    }

    const result = await linkSubjectToActor(
      this.baseService,
      this.repositories,
      invitation.schoolId,
      this.buildLinkInput(invitation, input.subjectId),
    )

    await this.baseService.invitationDelivery.revoke(invitation.id)

    await this.repositories.accountInvitations.save(invitation.copyWith({
      status: AccountInvitationStatus.Accepted,
      acceptedAt: new Date(),
      acceptedSubjectId: input.subjectId,
    }))

    return result
  }

  async getInvitationPreviewByToken(token: string): Promise<AccountInvitation> {
    return this.requireValidInvitationToken(token)
  }

  private async createAndDeliverInvitation(
    input: SendAccountInvitationInput,
  ): Promise<SendAccountInvitationResult> {
    const channel = input.contactChannel ?? AccountInvitationContactChannel.Email
    const { displayName, contactValue } = await this.resolveTargetContact(input, channel)

    const pending = await this.repositories.accountInvitations.findPendingByTarget(
      this.baseService.actor.schoolId,
      input.kind,
      input.targetId,
    )
    if (pending) {
      await this.revokeInvitationDelivery(pending)
      await this.repositories.accountInvitations.save(pending.copyWith({
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

    await this.repositories.accountInvitations.save(invitation, { tokenHash })

    const schoolName = await resolveSchoolName(this.repositories, invitation.schoolId)
    const inviteUrl = buildInvitationUrl(input.inviteBaseUrl, token)
    const { emailSubject, emailBody } = await renderInvitationEmailContent(
      this.baseService.templateService,
      {
        schoolId: invitation.schoolId,
        templateKey: ACCOUNT_INVITATION_TEMPLATE_KEY,
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
      const contactValue = resolveInvitationContact(channel, input.contactValue, staff)
      return this.requireContact(contactValue, displayNameFor(staff))
    }

    if (input.kind === AccountInvitationKind.Guardian) {
      const guardian = await this.requireUnlinkedGuardian(input.targetId)
      const contactValue = resolveInvitationContact(channel, input.contactValue, undefined, guardian)
      return this.requireContact(contactValue, displayNameFor(guardian))
    }

    if (input.kind === AccountInvitationKind.Teacher) {
      const teacher = await this.requireUnlinkedTeacher(input.targetId)
      const contactValue = resolveInvitationContact(channel, input.contactValue, undefined, undefined, teacher)
      return this.requireContact(contactValue, displayNameFor(teacher))
    }

    const student = await this.requireUnlinkedStudent(input.targetId)
    const contactValue = resolveStudentInvitationEmail(input.contactValue)
    return this.requireContact(contactValue, displayNameFor(student))
  }

  private requireContact(
    contactValue: string | undefined,
    displayName: string,
  ): { displayName: string, contactValue: string } {
    if (!contactValue) {
      throw new BusinessRuleViolationError(
        'INVITATION_CONTACT_REQUIRED',
        'A deliverable contact is required to send an invitation',
      )
    }
    return { displayName, contactValue }
  }

  private async requireValidInvitationToken(token: string): Promise<AccountInvitation> {
    const invitation = await this.repositories.accountInvitations.findByTokenHash(hashInvitationToken(token))
    if (!invitation) {
      throw new BusinessRuleViolationError('INVITATION_NOT_FOUND', 'Invitation not found or invalid')
    }
    if (invitation.status === AccountInvitationStatus.Revoked) {
      throw new BusinessRuleViolationError('INVITATION_REVOKED', 'This invitation has been revoked')
    }
    if (invitation.status === AccountInvitationStatus.Expired
      || (invitation.status === AccountInvitationStatus.Pending && invitation.expiresAt <= new Date())) {
      throw new BusinessRuleViolationError('INVITATION_EXPIRED', 'This invitation has expired')
    }
    return invitation
  }

  private assertContactEmailMatches(invitation: AccountInvitation, contactEmail: string): void {
    if (invitation.contactChannel !== AccountInvitationContactChannel.Email) {
      return
    }
    const expected = normalizeInvitationEmail(invitation.contactValue)
    const actual = normalizeInvitationEmail(contactEmail)
    if (!expected || !actual || expected !== actual) {
      throw new BusinessRuleViolationError(
        'INVITATION_EMAIL_MISMATCH',
        'Signed-in email does not match the invitation contact',
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
    await this.baseService.invitationDelivery.revoke(invitation.id)
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
