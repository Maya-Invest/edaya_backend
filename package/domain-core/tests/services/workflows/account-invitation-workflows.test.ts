import type {
  Student,
  Teacher,
} from '../../../src'
import type { EffectiveGrants } from '../../../src/capabilities/authorization'
import { describe, expect, test } from 'bun:test'
import {
  AccountInvitation,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AccountInvitationStatus,
  ActorAssuranceLevel,
  createRepositoryAuthorizationPolicy,
  createStaffActorMetadata,
  Guardian,
  Permission,
  RecordingInvitationDeliveryPort,
  RecordingNotificationGateway,
  StaffMember,
} from '../../../src'
import { SchoolService } from '../../../src/application'
import { hashInvitationToken } from '../../../src/capabilities/invitations/invitation-token'
import { buildDefaultNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/defaults/manifest'
import { SchoolNotificationTemplates } from '../../../src/domain/messaging/school-notification-templates'
import { testFileStorage } from '../../support/test-file-storage'

function actorWithPermissions(permissions: readonly Permission[]) {
  const effectiveGrants: EffectiveGrants = {
    permissions: new Set(permissions),
    scopeGrants: permissions.map(permission => ({
      permission,
      scopeType: 'school',
      scopeEntityIds: ['sch1'],
    })),
    isElevated: false,
  }

  return createStaffActorMetadata({
    subjectId: 'admin-subject',
    staffMemberId: 'staff-admin',
    schoolId: 'sch1',
    requestId: 'req-1',
    authenticatedAt: new Date('2026-01-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants,
  })
}

function createInvitationContext(options: {
  guardians?: Guardian[]
  teachers?: Teacher[]
  students?: Student[]
} = {}) {
  const invitationDelivery = new RecordingInvitationDeliveryPort()
  const staffMember = new StaffMember({
    id: 'st9',
    schoolId: 'sch1',
    firstName: 'Paul',
    lastName: 'Martin',
    email: 'p.martin@school.edu',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  const savedInvitations: AccountInvitation[] = []
  const savedStaff: StaffMember[] = [staffMember]
  const savedGuardians: Guardian[] = options.guardians ?? []
  const savedTeachers: Teacher[] = options.teachers ?? []
  const savedStudents: Student[] = options.students ?? []

  const mockRepos = {
    schools: {
      findById: async (id: string) => id === 'sch1' ? { id: 'sch1' } : undefined,
    },
    staffMembers: {
      findById: async (id: string) => savedStaff.find(entry => entry.id === id),
      findOne: async (query: { subjectId?: string }) => {
        if (!query?.subjectId) {
          return undefined
        }
        return savedStaff.find(entry => entry.subjectId === query.subjectId)
      },
      save: async (entity: StaffMember) => {
        const index = savedStaff.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedStaff[index] = entity
        }
        else {
          savedStaff.push(entity)
        }
      },
    },
    guardians: {
      findById: async (id: string) => savedGuardians.find(entry => entry.id === id),
      findOne: async () => undefined,
      save: async (entity: Guardian) => {
        const index = savedGuardians.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedGuardians[index] = entity
        }
        else {
          savedGuardians.push(entity)
        }
      },
    },
    teachers: {
      findById: async (id: string) => savedTeachers.find(entry => entry.id === id),
      findOne: async () => undefined,
      save: async (entity: Teacher) => {
        const index = savedTeachers.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedTeachers[index] = entity
        }
        else {
          savedTeachers.push(entity)
        }
      },
    },
    students: {
      findById: async (id: string) => savedStudents.find(entry => entry.id === id),
      findOne: async () => undefined,
      save: async (entity: Student) => {
        const index = savedStudents.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedStudents[index] = entity
        }
        else {
          savedStudents.push(entity)
        }
      },
    },
    guardianLinks: {
      list: async () => [],
    },
    accountInvitations: {
      findById: async (id: string) => savedInvitations.find(entry => entry.id === id),
      findByTokenHash: async (tokenHash: string) => savedInvitations.find(entry => entry.tokenHash === tokenHash),
      findPendingByTarget: async (schoolId: string, kind: AccountInvitationKind, targetId: string) =>
        savedInvitations.find(entry =>
          entry.schoolId === schoolId
          && entry.kind === kind
          && entry.targetId === targetId
          && entry.status === AccountInvitationStatus.Pending,
        ),
      save: async (entity: AccountInvitation) => {
        const index = savedInvitations.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedInvitations[index] = entity
        }
        else {
          savedInvitations.push(entity)
        }
      },
    },
  } as unknown as import('../../../src/ports').SchoolRepositories

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: createRepositoryAuthorizationPolicy({ repositories: mockRepos }),
    actor: actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN]),
    atomicExecution: { execute: <T>(operation: () => Promise<T>) => operation() },
    notificationGateway: new RecordingNotificationGateway(),
    fileStorage: testFileStorage,
    invitationDelivery,
  })

  return {
    invitationDelivery,
    mockRepos,
    savedInvitations,
    savedStaff,
    service,
    staffMember,
  }
}

describe('AccountInvitationServiceWorkflow', () => {
  test('sendAccountInvitation creates invitation and delivers via transient subscriber', async () => {
    const { service, invitationDelivery, savedInvitations } = createInvitationContext()

    const result = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(result.token.length).toBeGreaterThan(20)
    expect(savedInvitations).toHaveLength(1)
    expect(savedInvitations[0]?.status).toBe(AccountInvitationStatus.Pending)
    expect(savedInvitations[0]?.contactValue).toBe('p.martin@school.edu')
    expect(invitationDelivery.deliveries).toHaveLength(1)
    expect(invitationDelivery.deliveries[0]?.invitationId).toBe(savedInvitations[0]?.id)
    expect(invitationDelivery.deliveries[0]?.contactValue).toBe('p.martin@school.edu')
    expect(invitationDelivery.deliveries[0]?.inviteUrl).toContain(encodeURIComponent(result.token))
  })

  test('sendAccountInvitation delivers email rendered from school template document', async () => {
    const invitationDelivery = new RecordingInvitationDeliveryPort()
    const staffMember = new StaffMember({
      id: 'st9',
      schoolId: 'sch1',
      firstName: 'Paul',
      lastName: 'Martin',
      email: 'p.martin@school.edu',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    })

    const templates = await buildDefaultNotificationTemplateDocument()
    templates.account_invitation = {
      email: {
        subject: 'Join {{schoolName}} — {{inviteeName}}',
        body: '<p>Custom invite for {{inviteeName}} at {{schoolName}}</p>',
      },
    }

    const savedInvitations: AccountInvitation[] = []
    const mockRepos = {
      schools: {
        findById: async (id: string) => id === 'sch1' ? { id: 'sch1', name: 'Edaya School' } : undefined,
      },
      staffMembers: {
        findById: async (id: string) => id === 'st9' ? staffMember : undefined,
        findOne: async () => undefined,
        save: async () => {},
      },
      guardians: {
        findById: async () => undefined,
        findOne: async () => undefined,
        save: async () => {},
      },
      students: {
        findById: async () => undefined,
        findOne: async () => undefined,
        save: async () => {},
      },
      guardianLinks: {
        list: async () => [],
      },
      schoolNotificationTemplates: {
        findById: async () => new SchoolNotificationTemplates({
          schoolId: 'sch1',
          templates,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
      accountInvitations: {
        findById: async () => undefined,
        findByTokenHash: async () => undefined,
        findPendingByTarget: async () => undefined,
        save: async (entity: AccountInvitation) => {
          savedInvitations.push(entity)
        },
      },
    } as unknown as import('../../../src/ports').SchoolRepositories

    const service = new SchoolService({
      repositories: mockRepos,
      authorizationPolicy: {
        checkClassGroupAccess: async () => {},
        checkLessonSessionAccess: async () => {},
      } as unknown as import('../../../src/capabilities/authorization').AuthorizationPolicy,
      actor: actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN]),
      atomicExecution: { execute: <T>(operation: () => Promise<T>) => operation() },
      notificationGateway: new RecordingNotificationGateway(),
      fileStorage: testFileStorage,
      invitationDelivery,
    })

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
    const { service, invitationDelivery, savedInvitations, savedStaff } = createInvitationContext()

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const result = await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'p.martin@school.edu',
    })

    expect(result.kind).toBe('staff')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect(savedStaff[0]?.subjectId).toBe('auth-user-1')
    expect(savedInvitations[0]?.status).toBe(AccountInvitationStatus.Accepted)
    expect(savedInvitations[0]?.acceptedSubjectId).toBe('auth-user-1')
    expect(savedInvitations[0]?.id).toBeDefined()
    expect(invitationDelivery.revokedInvitationIds).toContain(savedInvitations[0]!.id)
  })

  test('acceptAccountInvitation rejects mismatched email', async () => {
    const { service } = createInvitationContext()

    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await expect(service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'other@school.edu',
    })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' })
  })

  test('revokeAccountInvitation revokes delivery and marks invitation revoked', async () => {
    const { service, invitationDelivery, savedInvitations } = createInvitationContext()

    const { invitation } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const revoked = await service.accountInvitationWorkflow.revokeAccountInvitation({
      invitationId: invitation.id,
    })

    expect(revoked.status).toBe(AccountInvitationStatus.Revoked)
    expect(savedInvitations[0]?.status).toBe(AccountInvitationStatus.Revoked)
    expect(invitationDelivery.revokedInvitationIds).toContain(invitation.id)
  })

  test('resendAccountInvitation revokes the existing invitation and creates a new pending one', async () => {
    const { service, invitationDelivery, savedInvitations } = createInvitationContext()

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
    expect(savedInvitations).toHaveLength(2)
    expect(savedInvitations.find(entry => entry.id === invitation.id)?.status)
      .toBe(AccountInvitationStatus.Revoked)
    expect(savedInvitations.find(entry => entry.id === result.invitation.id)?.status)
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
    const { invitationDelivery, savedInvitations, service } = createInvitationContext({ guardians: [guardian] })

    const result = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Guardian,
      targetId: 'gua1',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    expect(result.invitation.kind).toBe(AccountInvitationKind.Guardian)
    expect(savedInvitations[0]?.contactValue).toBe('grace@school.edu')
    expect(invitationDelivery.deliveries).toHaveLength(1)
  })

  test('getInvitationPreviewByToken returns a pending invitation', async () => {
    const { service } = createInvitationContext()
    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const preview = await service.accountInvitationWorkflow.getInvitationPreviewByToken(token)
    expect(preview.status).toBe(AccountInvitationStatus.Pending)
  })

  test('acceptAccountInvitation is idempotent for the same subject', async () => {
    const { service } = createInvitationContext()
    const { token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    const first = await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'p.martin@school.edu',
    })
    const second = await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'p.martin@school.edu',
    })

    expect(second.entity.subjectId).toBe(first.entity.subjectId)
  })

  test('acceptAccountInvitation rejects expired invitations', async () => {
    const { savedInvitations, service } = createInvitationContext()
    const token = 'expired-token'
    savedInvitations.push(new AccountInvitation({
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

    await expect(service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'p.martin@school.edu',
    })).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' })
  })

  test('revokeAccountInvitation rejects already accepted invitations', async () => {
    const { service } = createInvitationContext()
    const { invitation, token } = await service.accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: 'st9',
      inviteBaseUrl: 'https://app.edaya.test/invite',
    })

    await service.accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId: 'auth-user-1',
      contactEmail: 'p.martin@school.edu',
    })

    await expect(service.accountInvitationWorkflow.revokeAccountInvitation({
      invitationId: invitation.id,
    })).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' })
  })
})

describe('invitation token helpers', () => {
  test('hashInvitationToken is stable for lookup', () => {
    const token = 'sample-token-value'
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
  })
})
