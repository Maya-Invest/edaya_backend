import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import { BusinessRuleViolationError, noOpNotificationGateway, School, withShortName } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('school ownership policies and invariants', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = CASE id WHEN \'school-a\' THEN \'person-a\' ELSE \'person-b\' END')
    service = new SchoolService({ commandJournal: new PostgresCommandJournal(), actor: createStaffActorMetadata({ staffMemberId: 'staff-a', subjectId: 'person-a', schoolId: 'school-a', requestId: 'ownership', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
  })
  afterEach(async () => releaseDatabase(fixture.db))

  test('commands and direct saves reject removing the owner', async () => {
    const ownerSubjectId = null
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: before.id, ownerSubjectId })).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await expect(service.baseService.entities.schools.save(new School(withShortName({ ...before.data, ownerSubjectId })))).rejects.toBeInstanceOf(BusinessRuleViolationError)
    expect((await fixture.repositories.schools.findById(before.id))?.data).toEqual(before.data)
  })

  test.each(['command', 'save'])('current owner may transfer to an account owning another school through %s', async (operation) => {
    const before = (await fixture.repositories.schools.findById('school-a'))!
    if (operation === 'command')
      await service.setupWorkflow.updateSchoolConfiguration({ schoolId: before.id, ownerSubjectId: 'person-b' })
    else
      await service.baseService.entities.schools.save(new School(withShortName({ ...before.data, ownerSubjectId: 'person-b' })))
    expect((await fixture.repositories.schools.findById('school-a'))?.ownerSubjectId).toBe('person-b')
    expect((await fixture.repositories.schools.findById('school-b'))?.ownerSubjectId).toBe('person-b')
  })

  test('current owner may transfer, and loses owner authority immediately', async () => {
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await service.baseService.entities.schools.save(new School(withShortName({ ...before.data, ownerSubjectId: 'new-owner' })))
    expect((await fixture.repositories.schools.findById(before.id))?.ownerSubjectId).toBe('new-owner')
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: before.id, ownerSubjectId: 'person-a' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('explicit seed job cannot bypass current-owner transfer policy', async () => {
    const seed = new SchoolService({ commandJournal: new PostgresCommandJournal(), actor: createSystemActorMetadata({ systemId: 'fixture-seed', schoolId: 'school-a', reason: 'Fixture', requestId: 'seed' }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await expect(seed.baseService.entities.schools.save(new School(withShortName({ ...before.data, ownerSubjectId: 'new-owner' })))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
