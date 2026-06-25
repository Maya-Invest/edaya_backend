import type { EffectiveGrants } from '../../../src/authorization'
import type { AccountInvitation } from '../../../src/domains/access/account-invitation'
import { describe, expect, mock, test } from 'bun:test'
import {
  AccountInvitationKind,
  AccountInvitationStatus,
  ActorAssuranceLevel,
  createStaffActorMetadata,
  Permission,
  RecordingInvitationDeliveryPort,
  RecordingNotificationGateway,
  StaffMember,
} from '../../../src'
import { hashInvitationToken } from '../../../src/invitations/invitation-token'
import { SchoolService } from '../../../src/services'

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

function createInvitationContext() {
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

  const mockRepos = {
    schools: {
      findById: mock(async (id: string) => id === 'sch1' ? { id: 'sch1' } : undefined),
    },
    staffMembers: {
      findById: mock(async (id: string) => savedStaff.find(entry => entry.id === id)),
      findOne: mock(async (query: { subjectId?: string }) => {
        if (!query?.subjectId) {
          return undefined
        }
        return savedStaff.find(entry => entry.subjectId === query.subjectId)
      }),
      save: mock(async (entity: StaffMember) => {
        const index = savedStaff.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedStaff[index] = entity
        }
        else {
          savedStaff.push(entity)
        }
      }),
    },
    guardians: {
      findById: mock(async () => undefined),
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
    },
    students: {
      findById: mock(async () => undefined),
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
    },
    guardianLinks: {
      list: mock(async () => []),
    },
    accountInvitations: {
      findById: mock(async (id: string) => savedInvitations.find(entry => entry.id === id)),
      findByTokenHash: mock(async (tokenHash: string) => savedInvitations.find(entry => entry.tokenHash === tokenHash)),
      findPendingByTarget: mock(async (schoolId: string, kind: AccountInvitationKind, targetId: string) =>
        savedInvitations.find(entry =>
          entry.schoolId === schoolId
          && entry.kind === kind
          && entry.targetId === targetId
          && entry.status === AccountInvitationStatus.Pending,
        )),
      save: mock(async (entity: AccountInvitation) => {
        const index = savedInvitations.findIndex(entry => entry.id === entity.id)
        if (index >= 0) {
          savedInvitations[index] = entity
        }
        else {
          savedInvitations.push(entity)
        }
      }),
    },
  } as unknown as import('../../../src/ports').SchoolRepositories

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: {
      checkClassGroupAccess: mock(async () => {}),
      checkSessionAccess: mock(async () => {}),
    } as unknown as import('../../../src/authorization').AuthorizationPolicy,
    actor: actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN]),
    atomicExecution: { execute: <T>(operation: () => Promise<T>) => operation() },
    notificationGateway: new RecordingNotificationGateway(),
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
})

describe('invitation token helpers', () => {
  test('hashInvitationToken is stable for lookup', () => {
    const token = 'sample-token-value'
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token))
  })
})
