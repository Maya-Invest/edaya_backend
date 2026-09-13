import { ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import { BusinessRuleViolationError, noOpNotificationGateway, School } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

describe('school ownership policies and invariants', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = CASE id WHEN \'school-a\' THEN \'person-a\' ELSE \'person-b\' END')
    service = new SchoolService({
      actor: createStaffActorMetadata({ staffMemberId: 'staff-a', subjectId: 'person-a', schoolId: 'school-a', requestId: 'ownership', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }),
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })
  })
  afterEach(async () => fixture.db.close())

  test.each([null, 'person-b'])('commands and direct saves reject invalid owner %s', async (ownerSubjectId) => {
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: before.id, ownerSubjectId })).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await expect(service.baseService.entities.schools.save(new School({ ...before.data, ownerSubjectId }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
    expect((await fixture.repositories.schools.findById(before.id))?.data).toEqual(before.data)
  })

  test('current owner may transfer, and loses owner authority immediately', async () => {
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await service.baseService.entities.schools.save(new School({ ...before.data, ownerSubjectId: 'new-owner' }))
    expect((await fixture.repositories.schools.findById(before.id))?.ownerSubjectId).toBe('new-owner')
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: before.id, ownerSubjectId: 'person-a' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('explicit seed job cannot bypass current-owner transfer policy', async () => {
    const seed = new SchoolService({
      actor: createSystemActorMetadata({ systemId: 'fixture-seed', schoolId: 'school-a', reason: 'Fixture', requestId: 'seed' }),
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })
    const before = (await fixture.repositories.schools.findById('school-a'))!
    await expect(seed.baseService.entities.schools.save(new School({ ...before.data, ownerSubjectId: 'new-owner' }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
