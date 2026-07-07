import type { BaseSchoolService } from '../../../src/application/base-school-service'
import type { AccountInvitation } from '../../../src/domain/access/account-invitation'
import { describe, expect, test } from 'bun:test'
import {
  AccountInvitationKind,
  ActorAssuranceLevel,
  createRepositoryAuthorizationPolicy,
  createStaffActorMetadata,
  Permission,
  RecordingInvitationDeliveryPort,
  StaffMember,
  Student,
} from '../../../src'
import { RecordingNotificationGateway } from '../../../src/adapters'
import { SchoolService } from '../../../src/application'
import { scheduleAccountInvitationIfEligible } from '../../../src/capabilities/invitations/schedule-account-invitation'
import { testFileStorage } from '../../support/test-file-storage'

function createScheduleContext() {
  const invitationDelivery = new RecordingInvitationDeliveryPort()
  const student = new Student({
    id: 'student-1',
    schoolId: 'school-1',
    firstName: 'Alan',
    lastName: 'Turing',
  })
  const savedInvitations: AccountInvitation[] = []

  const repositories = {
    schools: {
      findById: async (id: string) => (id === 'school-1' ? { id: 'school-1' } : undefined),
    },
    staffMembers: {
      findById: async () => undefined,
      findOne: async () => undefined,
      save: async () => {},
    },
    guardians: {
      findById: async () => undefined,
      findOne: async () => undefined,
      save: async () => {},
    },
    teachers: {
      findById: async () => undefined,
      findOne: async () => undefined,
      save: async () => {},
    },
    students: {
      findById: async (id: string) => (id === student.id ? student : undefined),
      findOne: async () => undefined,
      save: async () => {},
    },
    guardianLinks: { list: async () => [] },
    accountInvitations: {
      findPendingByTarget: async () => undefined,
      save: async (entity: AccountInvitation) => {
        savedInvitations.push(entity)
      },
    },
  } as unknown as import('../../../src/ports').SchoolRepositories

  const actor = createStaffActorMetadata({
    subjectId: 'admin-subject',
    staffMemberId: 'staff-admin',
    schoolId: 'school-1',
    requestId: 'req-1',
    authenticatedAt: new Date('2026-01-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: {
      permissions: new Set([Permission.ACCESS_CONTROL_ASSIGN]),
      scopeGrants: [{
        permission: Permission.ACCESS_CONTROL_ASSIGN,
        scopeType: 'school',
        scopeEntityIds: ['school-1'],
      }],
      isElevated: false,
    },
  })

  const service = new SchoolService({
    repositories,
    authorizationPolicy: createRepositoryAuthorizationPolicy({ repositories }),
    actor,
    atomicExecution: { execute: <T>(operation: () => Promise<T>) => operation() },
    notificationGateway: new RecordingNotificationGateway(),
    fileStorage: testFileStorage,
    invitationDelivery,
    accountInvitationsEnabled: true,
    inviteBaseUrl: 'https://app.edaya.test/invite',
  })

  return {
    baseService: service.baseService,
    invitationDelivery,
    savedInvitations,
    student,
  }
}

describe('scheduleAccountInvitationIfEligible', () => {
  test('returns early when invitation delivery is disabled or the actor is already linked', () => {
    const staff = new StaffMember({
      id: 'staff-1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-linked',
      isActive: true,
    })
    const baseService = {
      accountInvitationsEnabled: true,
      inviteBaseUrl: 'https://app.edaya.test/invite',
    } as BaseSchoolService

    expect(() => scheduleAccountInvitationIfEligible(
      baseService,
      {
        kind: AccountInvitationKind.Staff,
        targetId: 'staff-1',
        sendAccountInvitation: false,
      },
      staff,
    )).not.toThrow()

    expect(() => scheduleAccountInvitationIfEligible(
      { ...baseService, accountInvitationsEnabled: false },
      {
        kind: AccountInvitationKind.Staff,
        targetId: 'staff-1',
        sendAccountInvitation: true,
      },
      staff,
    )).not.toThrow()

    expect(() => scheduleAccountInvitationIfEligible(
      { ...baseService, inviteBaseUrl: undefined },
      {
        kind: AccountInvitationKind.Staff,
        targetId: 'staff-1',
        sendAccountInvitation: true,
      },
      staff,
    )).not.toThrow()

    expect(() => scheduleAccountInvitationIfEligible(
      baseService,
      {
        kind: AccountInvitationKind.Staff,
        targetId: 'staff-1',
        sendAccountInvitation: true,
      },
      staff,
    )).not.toThrow()
  })

  test('schedules student invitations asynchronously when eligibility checks pass', async () => {
    const { baseService, invitationDelivery, savedInvitations, student } = createScheduleContext()

    scheduleAccountInvitationIfEligible(baseService, {
      kind: AccountInvitationKind.Student,
      targetId: student.id,
      sendAccountInvitation: true,
      inviteEmail: ' Student@School.edu ',
    }, student)

    await new Promise(resolve => setTimeout(resolve, 25))

    expect(savedInvitations).toHaveLength(1)
    expect(savedInvitations[0]?.contactValue).toBe('student@school.edu')
    expect(invitationDelivery.deliveries).toHaveLength(1)
  })

  test('swallows invitation failures so registration can continue', async () => {
    const { baseService, student } = createScheduleContext()
    const failingService = {
      ...baseService,
      actor: createStaffActorMetadata({
        subjectId: 'viewer-subject',
        staffMemberId: 'staff-viewer',
        schoolId: 'school-1',
        requestId: 'req-2',
        authenticatedAt: new Date('2026-01-01T00:00:00Z'),
        assuranceLevel: ActorAssuranceLevel.Strong,
        effectiveGrants: {
          permissions: new Set([]),
          scopeGrants: [],
          isElevated: false,
        },
      }),
    } as BaseSchoolService

    expect(() => scheduleAccountInvitationIfEligible(failingService, {
      kind: AccountInvitationKind.Student,
      targetId: student.id,
      sendAccountInvitation: true,
      inviteEmail: 'student@school.edu',
    }, student)).not.toThrow()

    await new Promise(resolve => setTimeout(resolve, 25))
  })
})
