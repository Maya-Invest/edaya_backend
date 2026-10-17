import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import {
  AcademicYear,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AccountInvitationStatus,
  noOpFileStorage,
  noOpNotificationGateway,
  Permission,
  RecordingInvitationDeliveryPort,
  School,
  StaffMember,
  StaffPermissionAssignment,
} from '@edaya/core'
import { resolveStructureTemplates } from '@edaya/fixtures/onboarding'
import { provisionOnboarding, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')

const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const repositories = handles.map(handle => new PostgresSchoolRepositories(handle.db))
const invitationDelivery = new RecordingInvitationDeliveryPort()
const applications = handles.map((handle, index) => new SchoolApplication({
  repositories: repositories[index]!,
  atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb),
  commandJournal: new PostgresCommandJournal(),
  fileStorage: noOpFileStorage,
  notificationGateway: noOpNotificationGateway,
  invitationDelivery,
}))

const inviteSchoolId = 'invite-integrity-school'
const staffId = 'invite-integrity-staff'
const targetStaffId = 'invite-integrity-target'
const adminSubject = 'invite-integrity-admin'

function typicalProvisionInput(schoolId: string, requestId: string) {
  const templates = resolveStructureTemplates(['ci-college'])
  const level = templates[0]?.gradeLevels[0]
  if (!level) {
    throw new Error('Missing CI college template')
  }
  return {
    schoolId,
    requestId,
    school: {
      name: 'Native Provision School',
      timeZone: 'Africa/Abidjan',
      city: 'Abidjan',
      country: 'CI',
      academicYearLabel: '2026-2027',
      academicYearStart: '2026-09-01',
      academicYearEnd: '2027-07-03',
      periodType: 'trimester' as const,
      periods: [{ label: 'Trimestre 1', start: '2026-09-01', end: '2026-12-19' }],
    },
    structure: {
      templates: ['ci-college'],
      templateSnapshots: templates,
      levels: [{
        gradeLevelId: level.id,
        classCount: 1,
        capacity: 30,
        classNamingMode: 'numerical' as const,
      }],
    },
  }
}

beforeAll(async () => {
  await repositories[0]!.init({ driver: 'node-postgres' })
  await repositories[0]!.schools.save(new School({ id: inviteSchoolId, name: 'Invite School', timeZone: 'UTC', ownerSubjectId: adminSubject }))
  await repositories[0]!.academicYears.save(new AcademicYear({
    id: 'invite-year',
    schoolId: inviteSchoolId,
    name: 'Year',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'published',
  }))
  await repositories[0]!.staffMembers.save(new StaffMember({
    id: staffId,
    schoolId: inviteSchoolId,
    firstName: 'Admin',
    lastName: 'Owner',
    email: 'admin@invite.test',
    isActive: true,
    subjectId: adminSubject,
  }))
  await repositories[0]!.staffMembers.save(new StaffMember({
    id: targetStaffId,
    schoolId: inviteSchoolId,
    firstName: 'Invited',
    lastName: 'Staff',
    email: 'invited@invite.test',
    isActive: true,
  }))
  await repositories[0]!.staffPermissionAssignments.save(new StaffPermissionAssignment({
    id: 'invite-assign',
    schoolId: inviteSchoolId,
    academicYearId: 'invite-year',
    staffId,
    permission: Permission.ACCESS_CONTROL_MANAGE,
    scopes: [{ kind: 'school' }],
  }))
})

afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

function staffService(index: number) {
  return applications[index]!.forActor(createStaffActorMetadata({
    schoolId: inviteSchoolId,
    staffMemberId: staffId,
    subjectId: adminSubject,
    requestId: `invite-${index}`,
    authenticatedAt: new Date(),
  }))
}

function acceptService(index: number) {
  return applications[index]!.forActor(createSystemActorMetadata({
    schoolId: inviteSchoolId,
    systemId: 'account-invitation-public',
    requestId: `accept-${index}`,
    reason: 'Accept invitation',
  }))
}

test('repeated provisioning with the same request replays; a changed payload conflicts', async () => {
  const schoolId = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const session = {
    user: {
      id: 'native-provision-owner',
      email: 'native-provision-owner@school.edu',
      name: 'Native Owner',
      emailVerified: true,
    },
  }
  const input = typicalProvisionInput(schoolId, requestId)
  const first = await provisionOnboarding(applications[0]!, session, input, { allowPublicSchoolRegistration: true })
  expect(first.replayed).toBeFalsy()
  const replay = await provisionOnboarding(applications[1]!, session, input, { allowPublicSchoolRegistration: true })
  expect(replay.schoolId).toBe(schoolId)
  expect(replay.replayed).toBe(true)
  await expect(provisionOnboarding(
    applications[0]!,
    session,
    { ...input, school: { ...input.school, name: 'Changed' } },
    { allowPublicSchoolRegistration: true },
  )).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
}, 30_000)

test('concurrent identical provision requests commit one school', async () => {
  const schoolId = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const session = {
    user: {
      id: 'native-concurrent-owner',
      email: 'native-concurrent-owner@school.edu',
      name: 'Concurrent Owner',
      emailVerified: true,
    },
  }
  const input = typicalProvisionInput(schoolId, requestId)
  const results = await Promise.all([
    provisionOnboarding(applications[0]!, session, input, { allowPublicSchoolRegistration: true }),
    provisionOnboarding(applications[1]!, session, input, { allowPublicSchoolRegistration: true }),
  ])
  expect(new Set(results.map(result => result.schoolId)).size).toBe(1)
  expect(results.some(result => result.replayed === true)).toBe(true)
}, 30_000)

test('concurrent accept of the same invitation serializes to one accepted row', async () => {
  const { token } = await staffService(0).accountInvitationWorkflow.sendAccountInvitation({
    kind: AccountInvitationKind.Staff,
    targetId: targetStaffId,
    contactChannel: AccountInvitationContactChannel.Email,
    inviteBaseUrl: 'https://app.edaya.test/invite',
  })
  const subjectId = 'invite-accept-subject'
  const results = await Promise.all([
    acceptService(0).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId,
      contactValue: 'invited@invite.test',
    }),
    acceptService(1).accountInvitationWorkflow.acceptAccountInvitation({
      token,
      subjectId,
      contactValue: 'invited@invite.test',
    }),
  ])
  expect(results.every(result => result.kind === 'staff' && result.entity.subjectId === subjectId)).toBe(true)
  const invitation = await repositories[0]!.accountInvitations.findByTokenHash(
    (await repositories[0]!.accountInvitations.list({ targetId: targetStaffId }))[0]?.tokenHash ?? '',
  )
  const pending = await repositories[0]!.accountInvitations.list({
    schoolId: inviteSchoolId,
    targetId: targetStaffId,
    status: AccountInvitationStatus.Accepted,
  })
  expect(pending).toHaveLength(1)
  expect(invitation?.status ?? pending[0]?.status).toBe(AccountInvitationStatus.Accepted)
}, 20_000)

test('accept rejects a target linked to another subject after the invite was sent', async () => {
  const otherTargetId = 'invite-integrity-linked-target'
  await repositories[0]!.staffMembers.save(new StaffMember({
    id: otherTargetId,
    schoolId: inviteSchoolId,
    firstName: 'Later',
    lastName: 'Linked',
    email: 'later-linked@invite.test',
    isActive: true,
  }))
  const { token } = await staffService(0).accountInvitationWorkflow.sendAccountInvitation({
    kind: AccountInvitationKind.Staff,
    targetId: otherTargetId,
    inviteBaseUrl: 'https://app.edaya.test/invite',
  })
  await repositories[0]!.staffMembers.save(new StaffMember({
    id: otherTargetId,
    schoolId: inviteSchoolId,
    firstName: 'Later',
    lastName: 'Linked',
    email: 'later-linked@invite.test',
    isActive: true,
    subjectId: 'already-taken',
  }))
  await expect(acceptService(0).accountInvitationWorkflow.acceptAccountInvitation({
    token,
    subjectId: 'would-replace',
    contactValue: 'later-linked@invite.test',
  })).rejects.toMatchObject({ code: 'ACTOR_SUBJECT_ALREADY_LINKED' })
}, 20_000)

test('concurrent sends of the same target leave one pending invitation', async () => {
  const concurrentTargetId = 'invite-integrity-concurrent-target'
  await repositories[0]!.staffMembers.save(new StaffMember({
    id: concurrentTargetId,
    schoolId: inviteSchoolId,
    firstName: 'Concurrent',
    lastName: 'Invitee',
    email: 'concurrent-invitee@invite.test',
    isActive: true,
  }))
  const results = await Promise.all([
    staffService(0).accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: concurrentTargetId,
      contactChannel: AccountInvitationContactChannel.Email,
      inviteBaseUrl: 'https://app.edaya.test/invite',
    }),
    staffService(1).accountInvitationWorkflow.sendAccountInvitation({
      kind: AccountInvitationKind.Staff,
      targetId: concurrentTargetId,
      contactChannel: AccountInvitationContactChannel.Email,
      inviteBaseUrl: 'https://app.edaya.test/invite',
    }),
  ])
  expect(results).toHaveLength(2)
  const pending = await repositories[0]!.accountInvitations.list({
    schoolId: inviteSchoolId,
    targetId: concurrentTargetId,
    status: AccountInvitationStatus.Pending,
  })
  expect(pending).toHaveLength(1)
}, 20_000)

test('failed provision rolls back so a later request can succeed at academic, structure, and invite phases', async () => {
  const session = {
    user: {
      id: 'native-rollback-owner',
      email: 'native-rollback-owner@school.edu',
      name: 'Rollback Owner',
      emailVerified: true,
    },
  }
  const schoolId = crypto.randomUUID()
  const academicFail = typicalProvisionInput(schoolId, crypto.randomUUID())
  academicFail.school.academicYearStart = 'not-a-date'
  await expect(provisionOnboarding(
    applications[0]!,
    session,
    academicFail,
    { allowPublicSchoolRegistration: true },
  )).rejects.toMatchObject({ code: 'INVALID_ACADEMIC_DATE' })
  expect(await repositories[0]!.schools.findById(schoolId)).toBeUndefined()

  const structureFail = typicalProvisionInput(schoolId, crypto.randomUUID())
  structureFail.structure.levels = [{
    ...structureFail.structure.levels[0]!,
    gradeLevelId: 'missing-level',
  }]
  await expect(provisionOnboarding(
    applications[0]!,
    session,
    structureFail,
    { allowPublicSchoolRegistration: true },
  )).rejects.toBeTruthy()
  expect(await repositories[0]!.schools.findById(schoolId)).toBeUndefined()

  const inviteFail = typicalProvisionInput(schoolId, crypto.randomUUID())
  await expect(provisionOnboarding(
    applications[0]!,
    session,
    {
      ...inviteFail,
      invites: [{ email: 'colleague@school.edu', role: 'not-a-role' }],
    },
    { allowPublicSchoolRegistration: true },
  )).rejects.toMatchObject({ code: 'STAFF_INVITE_INVALID_ROLE' })
  expect(await repositories[0]!.schools.findById(schoolId)).toBeUndefined()

  const retry = await provisionOnboarding(
    applications[0]!,
    session,
    typicalProvisionInput(schoolId, crypto.randomUUID()),
    { allowPublicSchoolRegistration: true },
  )
  expect(retry.schoolId).toBe(schoolId)
  expect(retry.replayed).toBeFalsy()
}, 30_000)
