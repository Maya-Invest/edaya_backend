import type { GuardianStudentLink, Student } from '../../src'
import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createRepositoryAuthorizationPolicy,
  Guardian,
  GuardianContactMethod,
  GuardianContactMethodType,
  MessageDeliveryRecipientKind,
  StaffMember,
} from '../../src'
import { buildStaffRecipientProfile } from '../../src/notifications/build-recipient-profile'
import { RecordingNotificationGateway } from '../../src/notifications/recording-notification-gateway'
import {
  ensureNotificationRecipientForActor,
  resolveNotificationRecipientProfileForActor,
  scheduleNotificationRecipientBackfillForActor,
  upsertNotificationRecipient,
} from '../../src/notifications/sync-notification-recipient'
import { BaseSchoolService } from '../../src/services/base-school-service'
import { createStore } from '../support/create-test-app'
import { effectiveGrantsForRoles } from '../support/effective-grants'
import { testFileStorage } from '../support/test-file-storage'

function createGuardianActor() {
  return createGuardianActorMetadata({
    subjectId: 'auth-g1',
    schoolId: 'school-1',
    guardianId: 'g1',
    requestId: 'req-1',
    authenticatedAt: new Date('2026-01-01T00:00:00Z'),
    effectiveGrants: effectiveGrantsForRoles([]),
    assuranceLevel: ActorAssuranceLevel.Standard,
  })
}

function createGuardianBaseService(gateway: RecordingNotificationGateway) {
  const guardians = createStore<Guardian>()
  const guardian = new Guardian({
    id: 'g1',
    schoolId: 'school-1',
    firstName: 'Claire',
    lastName: 'Laurent',
    email: 'c.laurent@mail.com',
    subjectId: 'auth-g1',
    contactMethods: [
      new GuardianContactMethod({
        type: GuardianContactMethodType.Email,
        value: 'c.laurent@mail.com',
        allowsNotifications: true,
      }),
    ],
    hasAccess: true,
  })
  void guardians.save(guardian)

  const repositories = {
    guardians,
    guardianLinks: createStore<GuardianStudentLink>(),
    staffMembers: createStore<StaffMember>(),
    students: createStore<Student>(),
  }

  const actor = createGuardianActor()
  const authorizationPolicy = createRepositoryAuthorizationPolicy({
    repositories: repositories as never,
    staffAssignmentRepository: createStore(),
    staffMemberRepository: repositories.staffMembers,
    guardianRepository: repositories.guardians,
    guardianStudentLinkRepository: repositories.guardianLinks,
    studentRepository: repositories.students,
  })

  const baseService = new BaseSchoolService({
    actor,
    repositories: repositories as never,
    authorizationPolicy,
    atomicExecution: { execute: <T>(operation: () => Promise<T>) => operation() },
    notificationGateway: gateway,
    fileStorage: testFileStorage,
  })

  return { baseService, actor }
}

describe('notification recipient sync', () => {
  test('resolveNotificationRecipientProfileForActor maps linked guardians with push enabled', async () => {
    const gateway = new RecordingNotificationGateway()
    const { baseService, actor } = createGuardianBaseService(gateway)

    const profile = await resolveNotificationRecipientProfileForActor(
      baseService.repositories,
      actor,
    )

    expect(profile).toMatchObject({
      schoolId: 'school-1',
      recipient: {
        kind: MessageDeliveryRecipientKind.Guardian,
        id: 'g1',
        subjectId: 'auth-g1',
      },
      preferences: {
        channels: {
          push: true,
        },
      },
    })
  })

  test('ensureNotificationRecipientForActor upserts the notifier subscriber profile', async () => {
    const gateway = new RecordingNotificationGateway()
    const { baseService, actor } = createGuardianBaseService(gateway)

    await ensureNotificationRecipientForActor(baseService, actor)

    expect(gateway.upserted).toHaveLength(1)
    expect(gateway.upserted[0]?.recipient.subjectId).toBe('auth-g1')
  })

  test('scheduleNotificationRecipientBackfillForActor upserts asynchronously', async () => {
    const gateway = new RecordingNotificationGateway()
    const { baseService, actor } = createGuardianBaseService(gateway)

    scheduleNotificationRecipientBackfillForActor(baseService, actor)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(gateway.upserted).toHaveLength(1)
  })

  test('upsertNotificationRecipient skips profiles without subjectId', async () => {
    const gateway = new RecordingNotificationGateway()
    const { baseService } = createGuardianBaseService(gateway)

    await upsertNotificationRecipient(baseService, undefined)
    await upsertNotificationRecipient(
      baseService,
      buildStaffRecipientProfile(new StaffMember({
        id: 'st1',
        schoolId: 'school-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        isActive: true,
      })),
    )

    expect(gateway.upserted).toHaveLength(0)
  })
})
