import { ActorAssuranceLevel, createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'
import { initializeFixtureSchoolOwner } from '../../src/capabilities/onboarding/initialize-fixture-school-owner'
import { SchoolApplication } from '../../src/services/school-application'

describe('admitted fixture owner initialization', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let application: SchoolApplication
  let journal: PostgresCommandJournal
  const actor = createSystemActorMetadata({ schoolId: 'school-a', systemId: 'fixture-seed', requestId: 'fixture-owner', reason: 'Disposable fixture' })
  const input = { schoolId: 'school-a', staffId: 'staff-a', subjectId: 'person-a' }
  const run = () => initializeFixtureSchoolOwner(application.forActor(actor).baseService, input)

  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    journal = new PostgresCommandJournal()
    application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, commandJournal: journal, fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway })
  })
  afterEach(async () => fixture.db.close())

  test('initializes once, preserves settings, and replays only the same currently linked owner', async () => {
    const school = (await fixture.repositories.schools.findById(input.schoolId))!
    const before = new School({ ...school.data, enforceScheduleConflicts: true, timetableEnforceWorkloadFulfillment: true })
    await fixture.repositories.schools.save(before)
    await run()
    await run()
    expect((await fixture.repositories.schools.findById(input.schoolId))?.data).toEqual(new School({ ...before.data, ownerSubjectId: input.subjectId }).data)
    const receipts = await fixture.db.query('SELECT result FROM command_receipts')
    expect(receipts.rows).toEqual([{ result: { schoolId: input.schoolId, staffId: input.staffId } }])
    expect((await fixture.db.query('SELECT event FROM command_audit')).rows).toEqual([{ event: 'school.fixture_owner_initialized' }])
    const staff = (await fixture.repositories.staffMembers.findById(input.staffId))!
    await fixture.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
    await expect(run()).rejects.toThrow()
  })

  test('rejects ordinary humans, other jobs, foreign schools and foreign or unlinked owner targets', async () => {
    const human = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', requestId: 'human', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong })
    const otherJob = createSystemActorMetadata({ ...actor, systemId: 'school-bootstrap' })
    for (const rejected of [human, otherJob])
      await expect(initializeFixtureSchoolOwner(application.forActor(rejected).baseService, input)).rejects.toThrow()
    for (const changes of [{ schoolId: 'school-b' }, { staffId: 'staff-b', subjectId: 'person-b' }, { subjectId: 'unlinked-subject' }, { subjectId: ' person-a ' }, { subjectId: '' }])
      await expect(initializeFixtureSchoolOwner(application.forActor(actor).baseService, { ...input, ...changes })).rejects.toThrow()
    expect((await fixture.repositories.schools.findById(input.schoolId))?.ownerSubjectId).toBeUndefined()
    expect((await fixture.db.query('SELECT id FROM command_receipts')).rows).toEqual([])
  })

  test('cannot transfer ownership, replace a pending invitation, or assign an identity owning another school', async () => {
    const before = (await fixture.repositories.schools.findById(input.schoolId))!
    for (const changes of [{ ownerSubjectId: 'current-owner' }, { pendingOwnerStaffId: input.staffId }]) {
      await fixture.repositories.schools.save(new School({ ...before.data, ...changes }))
      await expect(run()).rejects.toThrow()
      expect((await fixture.repositories.schools.findById(input.schoolId))?.data).toEqual(new School({ ...before.data, ...changes }).data)
    }
    await fixture.repositories.schools.save(before)
    const foreign = (await fixture.repositories.schools.findById('school-b'))!
    await fixture.repositories.schools.save(new School({ ...foreign.data, ownerSubjectId: input.subjectId }))
    await expect(run()).rejects.toMatchObject({ code: 'OWNER_SUBJECT_ALREADY_ASSIGNED' })
    expect((await fixture.repositories.schools.findById(input.schoolId))?.ownerSubjectId).toBeUndefined()
  })

  test('audit failure rolls ownership, receipt and audit back together', async () => {
    const complete = journal.complete.bind(journal)
    journal.complete = async (...args) => {
      await complete(...args)
      throw new Error('Injected owner audit failure')
    }
    await expect(run()).rejects.toThrow('Injected owner audit failure')
    expect((await fixture.repositories.schools.findById(input.schoolId))?.ownerSubjectId).toBeUndefined()
    expect((await fixture.db.query('SELECT id FROM command_receipts')).rows).toEqual([])
    expect((await fixture.db.query('SELECT id FROM command_audit')).rows).toEqual([])
    journal.complete = complete
    await run()
    expect((await fixture.repositories.schools.findById(input.schoolId))?.ownerSubjectId).toBe(input.subjectId)
  })
})
