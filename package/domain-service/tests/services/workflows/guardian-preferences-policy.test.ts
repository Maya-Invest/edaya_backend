import { AuthorizationError, createGuardianActorMetadata } from '@edaya/authorization'
import { Guardian, GuardianStudentLink, noOpNotificationGateway } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

describe('guardian preference policies through persisted workflows and entities', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec(`UPDATE schools SET owner_subject_id = 'person-a' WHERE id = 'school-a'`)
    service = new SchoolService({
      actor: createGuardianActorMetadata({ guardianId: 'guardian-a', subjectId: 'person-a', schoolId: 'school-a', requestId: 'preferences', authenticatedAt: new Date() }),
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })
  })
  afterEach(async () => fixture.db.close())

  test('updates own contacts without child links and preserves independent channel preferences', async () => {
    await fixture.repositories.guardianLinks.delete('guardian-link')
    const updated = await service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', email: 'new@example.test', emailNotificationsEnabled: false })
    expect(updated.email).toBe('new@example.test')
    expect(updated.emailNotificationsEnabled).toBe(false)
    expect(updated.pushNotificationsEnabled).toBe(true)
    expect((await fixture.repositories.guardians.findById('guardian-a'))?.data).toEqual(updated.data)
  })

  test('updates only notification opt-outs on an existing own link', async () => {
    const before = (await fixture.repositories.guardianLinks.findById('guardian-link'))!
    const updated = await service.studentWorkflow.updateGuardianStudentLink({ guardianId: 'guardian-a', studentId: 'student-a', receivesAcademicReports: false, receivesAttendanceAlerts: false, relationship: before.relationship, legalGuardian: before.legalGuardian })
    expect(updated.receivesAcademicReports).toBe(false)
    expect(updated.receivesAttendanceAlerts).toBe(false)
    expect(updated.legalGuardian).toBe(before.legalGuardian)
  })

  test.each([{ firstName: 'Changed' }, { hasAccess: false }])('denies administrative profile changes despite shared owner login: %j', async (changes) => {
    await expect(service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', ...changes })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('denies relationship changes, creation, reassignment and deletion through entities', async () => {
    const before = (await fixture.repositories.guardianLinks.findById('guardian-link'))!
    for (const changes of [{ legalGuardian: !before.legalGuardian }, { studentId: 'student-other' }, { studentId: 'student-b' }, { id: 'new-link' }]) {
      await expect(service.baseService.entities.guardianLinks.save(new GuardianStudentLink({ ...before.data, ...changes }))).rejects.toBeInstanceOf(AuthorizationError)
    }
    await expect(service.studentWorkflow.updateGuardianStudentLink({ guardianId: 'guardian-a', studentId: 'student-a', legalGuardian: !before.legalGuardian })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.guardianLinks.delete(before.id)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.guardians.delete('guardian-a')).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.guardianLinks.findById(before.id))?.data).toEqual(before.data)
  })

  test('denies generic identity edits and unrelated profiles', async () => {
    const before = (await fixture.repositories.guardians.findById('guardian-a'))!
    for (const changes of [{ subjectId: 'new-login' }, { firstName: 'Changed' }, { schoolId: 'school-b' }, { id: 'new-guardian' }]) {
      await expect(service.baseService.entities.guardians.save(new Guardian({ ...before.data, ...changes }))).rejects.toBeInstanceOf(AuthorizationError)
    }
    await fixture.repositories.guardians.save(new Guardian({ id: 'unrelated', schoolId: 'school-a', firstName: 'Other', lastName: 'Guardian', subjectId: 'person-unrelated' }))
    await expect(service.studentWorkflow.updateGuardianProfile({ guardianId: 'unrelated', email: 'other@example.test', emailNotificationsEnabled: true })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each(['UPDATE guardians SET has_access = false WHERE id = \'guardian-a\'', 'UPDATE guardians SET subject_id = \'new-login\' WHERE id = \'guardian-a\''])('rechecks profile after %s', async (mutation) => {
    await service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', email: 'keep@example.test', emailNotificationsEnabled: true })
    await fixture.db.exec(mutation)
    await expect(service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', email: 'again@example.test', emailNotificationsEnabled: true })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('removed links cannot be recreated by a stale preference request', async () => {
    const before = (await fixture.repositories.guardianLinks.findById('guardian-link'))!
    await fixture.repositories.guardianLinks.delete(before.id)
    await expect(service.baseService.entities.guardianLinks.save(new GuardianStudentLink({ ...before.data, receivesAcademicReports: false }))).rejects.toBeInstanceOf(AuthorizationError)
  })
  test('profile and child preferences commit atomically, including contact clears', async () => {
    await service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', phone: '+22501020304', alternativePhone: '+22505060708', emailNotificationsEnabled: false, pushNotificationsEnabled: false, studentNotificationPreferences: [{ studentId: 'student-a', receivesAttendanceAlerts: false }] })
    await service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', phone: null })
    const current = (await fixture.repositories.guardians.findById('guardian-a'))!
    expect(current.phone).toBeUndefined()
    expect(current.alternativePhone).toBe('+22505060708')
    expect(current.emailNotificationsEnabled).toBe(false)
    expect(current.pushNotificationsEnabled).toBe(false)
    expect((await fixture.repositories.guardianLinks.findById('guardian-link'))!.receivesAttendanceAlerts).toBe(false)
    await expect(service.studentWorkflow.updateGuardianProfile({ guardianId: 'guardian-a', email: 'rollback@example.test', studentNotificationPreferences: [{ studentId: 'student-a', receivesAttendanceAlerts: true }, { studentId: 'missing', receivesAttendanceAlerts: true }] })).rejects.toThrow()
    expect((await fixture.repositories.guardians.findById('guardian-a'))!.data).toEqual(current.data)
    expect((await fixture.repositories.guardianLinks.findById('guardian-link'))!.receivesAttendanceAlerts).toBe(false)
  })
})
