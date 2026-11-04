import type { Student, Teacher } from '@edaya/core'
import { createSystemActorMetadata } from '@edaya/authorization'
import { AcademicYear, AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, Guardian, Permission, RecordingInvitationDeliveryPort, RecordingNotificationGateway, School, SchoolNotificationTemplates, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { resolveInvitationDispatchRecipient, SchoolService } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { hashInvitationToken } from '../../../src/capabilities/invitations/invitation-token'
import { buildDefaultNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/defaults/manifest'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'
import { testFileStorage } from '../../support/test-file-storage'

function invitationAcceptanceService(service: SchoolService) {
  return new SchoolService({ ...service.baseService, actor: createSystemActorMetadata({ schoolId: service.baseService.actor.schoolId, systemId: 'account-invitation-public', requestId: 'accept-invitation', reason: 'Accept through verified invitation contact' }) })
}

async function createInvitationContext(options: { guardians?: Guardian[], teachers?: Teacher[], students?: Student[], pendingOwnerStaffId?: string, ownerSubjectId?: string, extraSchools?: School[] } = {}) {
  const actor = createTestStaffActor('sch1', 'staff-admin')
  const fixture = await createTestApp(actor)
  const repositories = fixture.schoolRepositories
  const invitationDelivery = new RecordingInvitationDeliveryPort()
  await repositories.schools.save(new School({ id: 'sch1', name: 'Edaya School', timeZone: 'Europe/Paris', pendingOwnerStaffId: options.pendingOwnerStaffId, ownerSubjectId: options.ownerSubjectId }))
  for (const school of options.extraSchools ?? []) await repositories.schools.save(school)
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'assign', schoolId: 'sch1', academicYearId: 'ay1', staffId: actor.staffMemberId, permission: Permission.ACCESS_CONTROL_MANAGE, scopes: [{ kind: 'school' }] }))
  await repositories.staffMembers.save(new StaffMember({ id: 'st9', schoolId: 'sch1', firstName: 'Paul', lastName: 'Martin', email: 'p.martin@school.edu', isActive: true }))
  for (const guardian of options.guardians ?? []) await repositories.guardians.save(guardian)
  for (const teacher of options.teachers ?? []) await repositories.teachers.save(teacher)
  for (const student of options.students ?? []) await repositories.students.save(student)
  const service = new SchoolService({ repositories, actor, atomicExecution: fixture.atomicExecution, notificationGateway: new RecordingNotificationGateway(), fileStorage: testFileStorage, invitationDelivery })
  return { invitationDelivery, repositories, accountInvitations: repositories.accountInvitations, staffMembers: repositories.staffMembers, schools: repositories.schools, service }
}

describe('AccountInvitationServiceWorkflow', () => {
  test('rolls back entity registration and invitation when admitted enqueue fails', async () => {
    const { service, repositories } = await createInvitationContext()
    const school = (await repositories.schools.findById('sch1'))!
    const actor = service.baseService.actor
    if (actor.kind !== 'staff')
      throw new Error('Staff fixture required')
    await repositories.schools.save(new School({ ...school.data, ownerSubjectId: actor.subjectId }))
    const registering = new SchoolService({ ...service.baseService, inviteBaseUrl: 'https://example.test/invite', invitationDelivery: {
      deliver: async () => { throw new Error('Invitation enqueue failed') },
      revoke: async () => {},
    } })
    await expect(registering.setupWorkflow.registerStaffMember({ id: 'enqueue-failure-staff', schoolId: 'sch1', firstName: 'Fixture', lastName: 'Staff', email: 'fixture@example.test' })).rejects.toThrow('Invitation enqueue failed')
    expect(await repositories.staffMembers.findById('enqueue-failure-staff')).toBeUndefined()
    expect(await repositories.accountInvitations.list({ targetId: 'enqueue-failure-staff' })).toHaveLength(0)
    expect(await registering.setupWorkflow.registerStaffMember({ id: 'no-contact-staff', schoolId: 'sch1', firstName: 'Fixture', lastName: 'No email' })).toMatchObject({ id: 'no-contact-staff' })
  })

  test('resolves queued invitation delivery only from current school-scoped pending state', async () => {
    const { service, repositories } = await createInvitationContext()
    const sent = await service.accountInvitationWorkflow.sendAccountInvitation({ kind: AccountInvitationKind.Staff, targetId: 'st9', inviteBaseUrl: 'https://example.test/invite' })
    const dispatch = new SchoolService({ ...service.baseService, actor: createSystemActorMetadata({ schoolId: 'sch1', systemId: 'invitation-dispatch', requestId: 'dispatch', reason: 'Test' }) })
    const request = { schoolId: 'sch1', invitationId: sent.invitation.id }
    expect(await resolveInvitationDispatchRecipient(dispatch.baseService, request)).toEqual({
      ...request,
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: sent.invitation.contactValue,
    })
    await expect(resolveInvitationDispatchRecipient(dispatch.baseService, { ...request, schoolId: 'other' })).rejects.toThrow()
    for (const status of [AccountInvitationStatus.Accepted, AccountInvitationStatus.Revoked, AccountInvitationStatus.Expired]) {
      await repositories.accountInvitations.save(sent.invitation.copyWith({ status }))
      expect(await resolveInvitationDispatchRecipient(dispatch.baseService, request)).toBeUndefined()
    }
  })

  test('sendAccountInvitation creates invitation and delivers via transient subscriber', async () => {
    const { service, invitationDelivery, accountInvitations } = await createInvitationContext()

    const result = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(result.token.length).toBeGreaterThan(20)
    expect(await accountInvitations.count()).toBe(1)
    expect((await accountInvitations.findOne({}))?.status).toBe(AccountInvitationStatus.Pending)
    expect((await accountInvitations.findOne({}))?.contactValue).toBe('p.martin@school.edu')
    expect(invitationDelivery.deliveries).toHaveLength(1)
    expect(invitationDelivery.deliveries[0]?.invitationId).toBe((await accountInvitations.findOne({}))?.id)
    expect(invitationDelivery.deliveries[0]?.contactValue).toBe('p.martin@school.edu')
    expect(invitationDelivery.deliveries[0]?.inviteUrl).toContain(encodeURIComponent(result.token))
  })

  test('sendAccountInvitation delivers email rendered from school template document', async () => {
    const { service, invitationDelivery, repositories } = await createInvitationContext()

    const templates = await buildDefaultNotificationTemplateDocument()
    await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
      schoolId: 'sch1',
      ...templates,
      accountInvitation: {
        ...templates.accountInvitation,
        rich_message: {
          subject: 'Join {{schoolName}} — {{inviteeName}}',
          body: '<p>Custom invite for {{inviteeName}} at {{schoolName}}</p>',
        },
      },
    }))

    await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(invitationDelivery.deliveries).toHaveLength(1)
    expect(invitationDelivery.deliveries[0]).toMatchObject({
      emailSubject: 'Join Edaya School — Paul Martin',
      emailBody: '<p>Custom invite for Paul Martin at Edaya School</p>',
    })
  })

  test('acceptAccountInvitation links staff and revokes transient delivery', async () => {
    const { service, invitationDelivery, accountInvitations, staffMembers } = await createInvitationContext()

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const result = await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })

    expect(result.kind).toBe('staff')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await staffMembers.findById('st9'))?.subjectId).toBe('auth-user-1')
    expect((await accountInvitations.findOne({}))?.status).toBe(AccountInvitationStatus.Accepted)
    expect((await accountInvitations.findOne({}))?.acceptedSubjectId).toBe('auth-user-1')
    expect((await accountInvitations.findOne({}))?.id).toBeDefined()
    expect(invitationDelivery.revokedInvitationIds).toContain((await accountInvitations.findOne({}))!.id)
  })

  test('acceptAccountInvitation rejects mismatched email', async () => {
    const { service } = await createInvitationContext()

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await expect(invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'other@school.edu',
    })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' })
  })

  test('revokeAccountInvitation revokes delivery and marks invitation revoked', async () => {
    const { service, invitationDelivery, accountInvitations } = await createInvitationContext()

    const { invitation } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const revoked = await service.accountInvitationWorkflow.revokeAccountInvitation({
      invitationId: invitation.id,
    })

    expect(revoked.status).toBe(AccountInvitationStatus.Revoked)
    expect((await accountInvitations.findOne({}))?.status).toBe(AccountInvitationStatus.Revoked)
    expect(invitationDelivery.revokedInvitationIds).toContain(invitation.id)
  })

  test('resendAccountInvitation revokes the existing invitation and creates a new pending one', async () => {
    const { service, invitationDelivery, accountInvitations } = await createInvitationContext()

    const { invitation, token: firstToken } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const result = await service.accountInvitationWorkflow.resendAccountInvitation({
      invitationId: invitation.id,
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(result.token).not.toBe(firstToken)
    expect(result.invitation.id).not.toBe(invitation.id)
    expect(result.invitation.status).toBe(AccountInvitationStatus.Pending)
    expect(await accountInvitations.count()).toBe(2)
    expect((await accountInvitations.findById(invitation.id))?.status)
      .toBe(AccountInvitationStatus.Revoked)
    expect((await accountInvitations.findById(result.invitation.id))?.status)
      .toBe(AccountInvitationStatus.Pending)
    expect(invitationDelivery.revokedInvitationIds).toContain(invitation.id)
    expect(invitationDelivery.deliveries.at(-1)?.invitationId).toBe(result.invitation.id)
  })

  test('sendAccountInvitation delivers guardian invitations', async () => {
    const guardian = new Guardian({
      id: 'gua1',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@school.edu',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const { invitationDelivery, accountInvitations, service } = await createInvitationContext({ guardians: [guardian] })

    const result = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Guardian,
      targetId: 'gua1',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(result.invitation.kind).toBe(AccountInvitationKind.Guardian)
    expect((await accountInvitations.findOne({}))?.contactValue).toBe('grace@school.edu')
    expect(invitationDelivery.deliveries).toHaveLength(1)
  })

  test('acceptAccountInvitation rejects a missing phone claim on a leftover phone invitation', async () => {
    const guardian = new Guardian({
      id: 'gua-phone',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '+2250102030405',
    })
    const { service, repositories } = await createInvitationContext({ guardians: [guardian] })
    const token = 'leftover-phone-token'
    await repositories.accountInvitations.save(new AccountInvitation({
      id: 'inv-phone-leftover',
      schoolId: 'sch1',
      kind: AccountInvitationKind.Guardian,
      targetId: guardian.id,
      contactChannel: AccountInvitationContactChannel.Phone,
      contactValue: '+2250102030405',
      tokenHash: hashInvitationToken(token),
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      createdByStaffId: 'staff-admin',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    await expect(invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'guardian-subject',
    })).rejects.toMatchObject({ code: 'INVITATION_PHONE_MISMATCH' })
  })

  test('sendAccountInvitation rejects phone invites until phone authentication ships', async () => {
    const guardian = new Guardian({
      id: 'gua-sms-off',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '+2250102030405',
    })
    const { service, repositories } = await createInvitationContext({ guardians: [guardian] })
    await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
      schoolId: 'sch1',
      ...await buildDefaultNotificationTemplateDocument(),
      invitationSmsEnabled: true,
    }))
    await expect(service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Guardian,
      targetId: guardian.id,
      contactChannel: AccountInvitationContactChannel.Phone,
      contactValue: '+2250102030405',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })).rejects.toMatchObject({ code: 'INVITATION_PHONE_UNSUPPORTED' })
  })

  test('getInvitationPreviewByToken returns a pending invitation', async () => {
    const { service } = await createInvitationContext()
    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const preview = await service.accountInvitationWorkflow.getInvitationPreviewByToken(token)
    expect(preview.status).toBe(AccountInvitationStatus.Pending)
  })

  test('acceptAccountInvitation is idempotent for the same subject', async () => {
    const { service } = await createInvitationContext()
    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const first = await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })
    const second = await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })

    expect(second.entity.subjectId).toBe(first.entity.subjectId)
  })

  test('acceptAccountInvitation rejects expired invitations', async () => {
    const { accountInvitations, service } = await createInvitationContext()
    const token = 'expired-token'
    await accountInvitations.save(new AccountInvitation({
      id: 'inv-expired',
      schoolId: 'sch1',
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: 'p.martin@school.edu',
      tokenHash: hashInvitationToken(token),
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date('2020-01-01T00:00:00Z'),
      createdByStaffId: 'staff-admin',
      createdAt: new Date('2020-01-01T00:00:00Z'),
    }))

    await expect(invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' })
  })

  test('revokeAccountInvitation rejects already accepted invitations', async () => {
    const { service } = await createInvitationContext()
    const { invitation, token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })

    await expect(service.accountInvitationWorkflow.revokeAccountInvitation({
      invitationId: invitation.id,
    })).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' })
  })

  test('acceptAccountInvitation assigns pending school owner and clears pending flag', async () => {
    const { service, schools } = await createInvitationContext({
      pendingOwnerStaffId: 'st9',
    })

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'owner-subject-1',
      contactValue: 'p.martin@school.edu',
    })

    expect((await schools.findById('sch1'))?.ownerSubjectId).toBe('owner-subject-1')
    expect((await schools.findById('sch1'))?.pendingOwnerStaffId).toBeUndefined()
  })

  test('acceptAccountInvitation accepts a pending owner who already owns another school', async () => {
    const { service, schools } = await createInvitationContext({
      pendingOwnerStaffId: 'st9',
      extraSchools: [
        new School({
          id: 'sch-other',
          name: 'Other School',
          timeZone: 'Europe/Paris',
          ownerSubjectId: 'owner-subject-1',
        }),
      ],
    })

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'owner-subject-1',
      contactValue: 'p.martin@school.edu',
    })
    for (const id of ['sch1', 'sch-other'])
      expect((await schools.findById(id))?.ownerSubjectId).toBe('owner-subject-1')
  })

  test('acceptAccountInvitationById links a guardian without a token', async () => {
    const guardian = new Guardian({
      id: 'gua-session',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@school.edu',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })
    const { service, accountInvitations, repositories } = await createInvitationContext({ guardians: [guardian] })
    const { invitation } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Guardian,
      targetId: guardian.id,
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const result = await invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitationById({
      invitationId: invitation.id,
      subjectId: 'auth-user-1',
      contactValue: 'grace@school.edu',
    })

    expect(result.kind).toBe('guardian')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect((await repositories.guardians.findById(guardian.id))?.subjectId).toBe('auth-user-1')
    expect((await accountInvitations.findById(invitation.id))?.status).toBe(AccountInvitationStatus.Accepted)
  })

  test('acceptAccountInvitation rejects a target linked to another subject after the invite was sent', async () => {
    const { service, repositories } = await createInvitationContext()
    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })
    await repositories.staffMembers.save(new StaffMember({
      id: 'st9',
      schoolId: 'sch1',
      firstName: 'Paul',
      lastName: 'Martin',
      email: 'p.martin@school.edu',
      isActive: true,
      subjectId: 'already-linked',
    }))

    await expect(invitationAcceptanceService(service).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactValue: 'p.martin@school.edu',
    })).rejects.toMatchObject({ code: 'ACTOR_SUBJECT_ALREADY_LINKED' })
  })
})

describe('invitation token helpers', () => {
  test('hashInvitationToken is stable for lookup', () => {
    const token = 'sample-token-value'
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
  })
})
