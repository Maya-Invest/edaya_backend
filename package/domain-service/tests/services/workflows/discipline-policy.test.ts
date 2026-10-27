import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { DisciplinaryAction, Incident, IncidentInvolvementRole, IncidentKind, IncidentStatus, LessonSession, noOpNotificationGateway, Permission, StaffPermissionAssignment, StudentDisciplinaryAction, StudentIncidentInvolvement } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'discipline', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
const teacher = createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })

describe('discipline policies authorize the incident and its participants', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  function app(actor = teacher) {
    return new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
  }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    service = app()
    for (const [id, subject] of [['math', 'math-a'], ['french', 'french-a']] as const)
      await fixture.repositories.lessonSessions.save(new LessonSession({ id, classSubjectId: subject, schoolId: 'school-a', classGroupId: 'class-a', startsAt: new Date('2026-05-01T08:00:00Z'), endsAt: new Date('2026-05-01T09:00:00Z'), displayLabel: id }))
    for (const [id, classGroupId, lessonSessionId] of [['class', 'class-a', undefined], ['math', 'class-a', 'math'], ['french', 'class-a', 'french'], ['lesson-only', undefined, 'math'], ['old', 'class-old', undefined], ['other', 'class-other', undefined], ['foreign', 'class-b', undefined]] as const) {
      await fixture.repositories.incidents.save(new Incident({ id, schoolId: id === 'foreign' ? 'school-b' : 'school-a', title: id, description: id, date: new Date('2026-05-01'), kind: IncidentKind.MinorInfraction, reporterId: 'staff-a', classGroupId, lessonSessionId }))
    }
    await fixture.repositories.disciplinaryActions.save(new DisciplinaryAction({ id: 'catalog', schoolId: 'school-a', name: 'Warning' }))
    for (const incidentId of ['math', 'french', 'lesson-only', 'old']) {
      await fixture.repositories.studentIncidentInvolvements.save(new StudentIncidentInvolvement({ id: incidentId, incidentId, studentId: 'student-a', role: IncidentInvolvementRole.Subject }))
      await fixture.repositories.studentDisciplinaryActions.save(new StudentDisciplinaryAction({ id: incidentId, schoolId: 'school-a', incidentId, studentId: 'student-a', disciplinaryActionId: 'catalog', assignedByStaffId: 'staff-a' }))
    }
  })
  afterEach(async () => releaseDatabase(fixture.db))

  test('subject reads apply incident, lesson and year constraints to list, count and single records', async () => {
    expect((await service.baseService.entities.incidents.list()).map(row => row.id).sort()).toEqual(['class', 'lesson-only', 'math'])
    for (const entity of [service.baseService.entities.studentIncidentInvolvements, service.baseService.entities.studentDisciplinaryActions]) {
      expect((await entity.list()).map(row => row.id).sort()).toEqual(['lesson-only', 'math'])
      expect(await entity.count()).toBe(2)
      expect(await entity.findById('french')).toBeUndefined()
      expect(await entity.findById('old')).toBeUndefined()
    }
  })

  test('homeroom reads include all current class lessons but not historical or unrelated incidents', async () => {
    await fixture.db.exec('UPDATE teacher_assignments SET kind = \'homeroom\', class_subject_id = NULL, class_group_id = \'class-a\' WHERE id = \'teaching\'')
    expect((await service.baseService.entities.incidents.list()).map(row => row.id).sort()).toEqual(['class', 'french', 'lesson-only', 'math'])
    expect((await service.baseService.entities.studentIncidentInvolvements.list()).map(row => row.id).sort()).toEqual(['french', 'lesson-only', 'math'])
  })

  test('both direct and command incident creation reject another subject lesson', async () => {
    const before = (await fixture.repositories.incidents.findById('french'))!
    const proposed = new Incident({ ...before.data, id: 'forbidden' })
    await expect(service.baseService.entities.incidents.save(proposed)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.behaviorWorkflow.recordIncident(proposed.data)).rejects.toBeInstanceOf(AuthorizationError)
    const own = (await fixture.repositories.incidents.findById('lesson-only'))!
    await service.behaviorWorkflow.recordIncident({ ...own.data, id: 'permitted' })
    expect(await fixture.repositories.incidents.findById('forbidden')).toBeUndefined()
    expect(await fixture.repositories.incidents.findById('permitted')).toBeDefined()
  })

  test('a mixed incident batch checks every target before persisting', async () => {
    const own = (await fixture.repositories.incidents.findById('math'))!
    const other = (await fixture.repositories.incidents.findById('french'))!
    await expect(service.baseService.entities.incidents.batchSave([new Incident({ ...own.data, id: 'batch-own' }), new Incident({ ...other.data, id: 'batch-other' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.incidents.findById('batch-own')).toBeUndefined()
  })

  test('knowing an enrolled student does not authorize direct involvement in another lesson', async () => {
    await fixture.repositories.studentIncidentInvolvements.delete('french')
    const involvement = new StudentIncidentInvolvement({ id: 'new', incidentId: 'french', studentId: 'student-a', role: IncidentInvolvementRole.Witness })
    await expect(service.baseService.entities.studentIncidentInvolvements.save(involvement)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.behaviorWorkflow.addStudentInvolvement(involvement.data)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('read grants cannot contribute to create scope and updates check both academic placements', async () => {
    service = new SchoolService({ actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'read', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_READ, scopes: [{ kind: 'all', grain: 'student' }] }))
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'create', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_CREATE, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const other = (await fixture.repositories.incidents.findById('other'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...other.data, id: 'new-other' }))).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'update', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_MANAGE, scopes: [{ kind: 'all', grain: 'class_group' }] }))
    const own = (await fixture.repositories.incidents.findById('class'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...own.data, classGroupId: 'class-old' }))).rejects.toBeInstanceOf(AuthorizationError)
    const old = (await fixture.repositories.incidents.findById('old'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...old.data, classGroupId: 'class-a' }))).rejects.toBeInstanceOf(AuthorizationError)
    await service.baseService.entities.incidents.save(new Incident({ ...own.data, title: 'Updated' }))
  })

  test('resolution requires validation authority and never borrows content-update authority', async () => {
    service = new SchoolService({ actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    for (const permission of [Permission.DISCIPLINE_READ, Permission.DISCIPLINE_MANAGE])
      await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const before = (await fixture.repositories.incidents.findById('class'))!
    const resolved = new Incident({ ...before.data, status: IncidentStatus.Resolved, resolutionNotes: 'Resolved', resolvedAt: new Date(), resolvedByStaffId: 'staff-a', updatedAt: new Date() })
    await expect(service.baseService.entities.incidents.save(resolved)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.behaviorWorkflow.resolveIncident({ incidentId: before.id })).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.delete(Permission.DISCIPLINE_MANAGE)
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'validate', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_VALIDATE, scopes: [{ kind: 'all', grain: 'class_group' }] }))
    await expect(service.baseService.entities.incidents.save(new Incident({ ...resolved.data, title: 'Changed content' }))).rejects.toBeInstanceOf(AuthorizationError)
    await service.behaviorWorkflow.resolveIncident({ incidentId: before.id })
    expect((await fixture.repositories.incidents.findById(before.id))?.status).toBe(IncidentStatus.Resolved)
  })

  test('validation alone resolves existing participants without borrowing create or read authority', async () => {
    service = new SchoolService({ actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'validate', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_VALIDATE, scopes: [{ kind: 'all', grain: 'class_group' }] }))
    const result = await service.behaviorWorkflow.resolveIncidentWithOutcomes({ incidentId: 'math', involvedStudents: [{ id: 'math', studentId: 'student-a', role: IncidentInvolvementRole.Subject }] })
    expect(result.incident.status).toBe(IncidentStatus.Resolved)
    expect(result.involvements.map(row => row.id)).toEqual(['math'])
    await service.behaviorWorkflow.resolveIncident({ incidentId: 'class' })
    expect((await fixture.repositories.incidents.findById('class'))?.status).toBe(IncidentStatus.Resolved)
  })

  test('resolving cannot add or alter participants without their distinct mutation authority', async () => {
    service = new SchoolService({ actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'validate', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.DISCIPLINE_VALIDATE, scopes: [{ kind: 'all', grain: 'class_group' }] }))
    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({ incidentId: 'math', involvedStudents: [{ id: 'math', studentId: 'student-a', role: IncidentInvolvementRole.Witness }] })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.behaviorWorkflow.resolveIncidentWithOutcomes({ incidentId: 'class', involvedStudents: [{ id: 'new', studentId: 'student-a', role: IncidentInvolvementRole.Subject }] })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.incidents.findById('math'))?.status).toBe(IncidentStatus.Open)
    expect((await fixture.repositories.studentIncidentInvolvements.findById('math'))?.role).toBe(IncidentInvolvementRole.Subject)
    expect(await fixture.repositories.studentIncidentInvolvements.findById('new')).toBeUndefined()
  })

  test('new incidents cannot smuggle a resolved state through create authority', async () => {
    const before = (await fixture.repositories.incidents.findById('math'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...before.data, id: 'resolved-create', status: IncidentStatus.Resolved, resolvedAt: new Date(), resolvedByStaffId: 'staff-a', updatedAt: new Date() }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('management combines editing, cancellation and deletion within scope, while create grants and revocation deny them', async () => {
    service = new SchoolService({ actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    const grant = async (permission: Permission) => fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    await grant(Permission.DISCIPLINE_CREATE)
    await grant(Permission.DISCIPLINE_READ)
    const before = (await fixture.repositories.incidents.findById('class'))!
    const cancelled = new Incident({ ...before.data, status: IncidentStatus.Cancelled, title: 'Changed' })
    await expect(service.baseService.entities.incidents.save(cancelled)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.incidents.delete(before.id)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.DISCIPLINE_MANAGE)
    const other = (await fixture.repositories.incidents.findById('other'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...other.data, status: IncidentStatus.Cancelled }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.incidents.delete(other.id)).rejects.toBeInstanceOf(AuthorizationError)
    await service.baseService.entities.incidents.save(cancelled)
    await fixture.repositories.staffPermissionAssignments.delete(Permission.DISCIPLINE_MANAGE)
    await expect(service.baseService.entities.incidents.save(before)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.incidents.delete(before.id)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.DISCIPLINE_MANAGE)
    await service.baseService.entities.incidents.delete(before.id)
    expect(await fixture.repositories.incidents.findById(before.id)).toBeUndefined()
  })

  test('create authority cannot introduce an already cancelled incident', async () => {
    const before = (await fixture.repositories.incidents.findById('math'))!
    await expect(service.baseService.entities.incidents.save(new Incident({ ...before.data, id: 'cancelled-create', status: IncidentStatus.Cancelled }))).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.incidents.findById('cancelled-create')).toBeUndefined()
  })

  test('guardian profile does not inherit same-login staff discipline access', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    service = new SchoolService({ actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await expect(service.baseService.entities.incidents.list()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.studentDisciplinaryActions.list()).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('removed teaching authority takes effect for all incident-linked records', async () => {
    await fixture.repositories.teacherAssignments.delete('teaching')
    expect(await service.baseService.entities.incidents.count()).toBe(0)
    expect(await service.baseService.entities.studentIncidentInvolvements.count()).toBe(0)
    expect(await service.baseService.entities.studentDisciplinaryActions.count()).toBe(0)
  })
})
