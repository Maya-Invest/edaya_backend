import { AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata } from '@edaya/authorization'
import { Guardian, GuardianStudentLink, noOpNotificationGateway, Permission, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { saveHumanFixture } from '../../../../../tooling/test-support/human-fixtures'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'guardian-link', authenticatedAt: new Date() }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })

describe('guardian linking uses its own action and shared enrollment validation', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await saveHumanFixture(fixture.repositories.guardians, new Guardian({ id: 'new-guardian', schoolId: 'school-a', firstName: 'Another', lastName: 'Guardian' }))
    service = new SchoolService({ commandJournal: new PostgresCommandJournal(), actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
  })
  afterEach(async () => releaseDatabase(fixture.db))
  async function grant(permission: Permission) {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission, scopes: permission === Permission.PARENT_READ ? [{ kind: 'all', grain: 'student' }] : [{ kind: 'school' }] }))
  }
  const input = { id: 'new-link', guardianId: 'new-guardian', studentId: 'student-a' }

  test('parent update alone authorizes linking; parent reads do not authorize mutation', async () => {
    await grant(Permission.PARENT_READ)
    await expect(service.studentWorkflow.linkGuardianToStudent(input)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.delete(Permission.PARENT_READ)
    await grant(Permission.PARENT_MANAGE)
    await service.studentWorkflow.linkGuardianToStudent(input)
    expect((await fixture.repositories.guardianLinks.findById(input.id))?.studentId).toBe(input.studentId)
  })

  test('direct saves and commands retain same-school enrollment and foreign-target invariants', async () => {
    await grant(Permission.PARENT_MANAGE)
    for (const row of await fixture.repositories.subjectEnrollments.list({ studentClassEnrollmentId: 'enrollment-a' }))
      await fixture.repositories.subjectEnrollments.delete(row.id)
    await fixture.repositories.enrollments.delete('enrollment-a')
    await expect(service.studentWorkflow.linkGuardianToStudent(input)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.guardianLinks.save(new GuardianStudentLink({ ...input, schoolId: 'school-a', relationship: 'parent' }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.studentWorkflow.linkGuardianToStudent({ ...input, studentId: 'student-b' })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.guardianLinks.findById(input.id)).toBeUndefined()
  })

  test('selected guardians cannot acquire new relationships from the same login’s staff authority', async () => {
    await grant(Permission.PARENT_MANAGE)
    const guardianService = new SchoolService({ ...service.baseService, commandJournal: new PostgresCommandJournal(), actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }) })
    await expect(guardianService.studentWorkflow.linkGuardianToStudent({ ...input, guardianId: 'guardian-a', studentId: 'student-other' })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
