import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Activity, ActivityCategory, ActivitySession, Assessment, AssessmentKind, BusinessRuleViolationError, LessonSession, noOpNotificationGateway, Permission, Resource, ResourceAssignment, ResourceKind, Schedule, ScheduleKind, StaffPermissionAssignment, withShortName } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const identity = { schoolId: 'school-a', subjectId: 'person-a', requestId: 'resource', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })
const startsAt = new Date('2026-05-01T08:00:00Z')
const endsAt = new Date('2026-05-01T09:00:00Z')
const targets = { lesson: { lessonSessionId: 'lesson' }, activity: { activitySessionId: 'activity' }, exam: { assessmentId: 'exam' } } as const

describe('resource policies and atomic placement invariants', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  async function grant(permission: Permission) {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission, scopes: permission === Permission.RESOURCE_CONFIGURE ? [{ kind: 'school' }] : [{ kind: 'all', grain: 'class_group' }] }))
  }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    service = new SchoolService({ commandJournal: new PostgresCommandJournal(), actor: staff, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    for (const id of ['room', 'other-room', 'foreign-room'])
      await fixture.repositories.resources.save(new Resource(withShortName({ id, schoolId: id === 'foreign-room' ? 'school-b' : 'school-a', name: id, kind: ResourceKind.Location })))
    await fixture.repositories.lessonSessions.save(new LessonSession({ id: 'lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', startsAt, endsAt, displayLabel: 'Math' }))
    await fixture.repositories.activities.save(new Activity(withShortName({ id: 'club', schoolId: 'school-a', name: 'Club', category: ActivityCategory.Arts, coach: 'Coach', schedule: 'Friday', participants: 0, capacity: 20, description: 'Club', startDate: startsAt, endDate: endsAt })))
    await fixture.repositories.schedules.save(new Schedule({ id: 'activity-schedule', schoolId: 'school-a', classGroupId: 'class-a', scheduleKind: ScheduleKind.Activity, activityId: 'club', title: 'Club', isRecurring: false, specificDate: startsAt, startTime: '08:00', endTime: '09:00' }))
    await fixture.repositories.activitySessions.save(new ActivitySession({ id: 'activity', schoolId: 'school-a', classGroupId: 'class-a', scheduleId: 'activity-schedule', activityId: 'club', startsAt, endsAt, displayLabel: 'Club' }))
    await fixture.repositories.assessments.save(new Assessment({ id: 'exam', classGroupId: 'class-a', classSubjectId: 'math-a', periodId: 'period-a', title: 'Exam', kind: AssessmentKind.Quiz, maxScore: 20, startsAt, endsAt }))
  })
  afterEach(async () => releaseDatabase(fixture.db))

  test('read scope includes each valid placement kind and excludes other years and schools before counts', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_READ)
    for (const [id, target] of Object.entries({ ...targets, class: { classGroupId: 'class-a' }, old: { classGroupId: 'class-old' }, foreign: { classGroupId: 'class-b' } }))
      await fixture.repositories.resourceAssignments.save(new ResourceAssignment({ id, resourceId: id === 'foreign' ? 'foreign-room' : 'room', ...target }))
    const entities = service.baseService.entities.resourceAssignments
    expect((await entities.list()).map(row => row.id).sort()).toEqual(['activity', 'class', 'exam', 'lesson'])
    expect(await entities.count()).toBe(4)
    expect(await entities.findById('old')).toBeUndefined()
    expect(await entities.findById('foreign')).toBeUndefined()
    expect((await entities.list({ $limit: 2, $offset: 1, $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['class', 'exam'])
  })

  test('read authority cannot assign a resource; command writes and revocation use current configure grants', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_READ)
    const input = { id: 'assign', resourceId: 'room', lessonSessionId: 'lesson' }
    await expect(service.setupWorkflow.assignResourceToLessonSession(input)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.RESOURCE_ASSIGNMENT_MANAGE)
    await service.setupWorkflow.assignResourceToLessonSession(input)
    expect(await fixture.repositories.resourceAssignments.findById('assign')).toBeDefined()
    await fixture.db.exec('UPDATE staff_permission_assignments SET ends_at = \'2000-01-01\' WHERE id = \'RESOURCE_ASSIGNMENT_MANAGE\'')
    await expect(service.setupWorkflow.removeResourceAssignment({ id: 'assign' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('reassignment checks both existing and proposed year/tenant before changing rows', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_MANAGE)
    const existing = new ResourceAssignment({ id: 'assigned', resourceId: 'room', lessonSessionId: 'lesson' })
    await service.baseService.entities.resourceAssignments.save(existing)
    for (const target of [{ resourceId: 'foreign-room', lessonSessionId: 'lesson' }, { resourceId: 'room', classGroupId: 'class-old' }, { resourceId: 'room', assessmentId: 'assessment-b' }])
      await expect(service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: existing.id, ...target }))).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.resourceAssignments.save(new ResourceAssignment({ id: 'old', resourceId: 'other-room', classGroupId: 'class-old' }))
    await expect(service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: 'old', resourceId: 'other-room', classGroupId: 'class-a' }))).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.resourceAssignments.findById(existing.id))?.data).toEqual(existing.data)
  })

  test('a mixed authorized/foreign batch persists nothing', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_MANAGE)
    await expect(service.baseService.entities.resourceAssignments.batchSave([
      new ResourceAssignment({ id: 'first', resourceId: 'room', lessonSessionId: 'lesson' }),
      new ResourceAssignment({ id: 'second', resourceId: 'other-room', classGroupId: 'class-b' }),
    ])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.resourceAssignments.count()).toBe(0)
  })

  test.each([['lesson', 'activity'], ['activity', 'lesson'], ['lesson', 'exam'], ['exam', 'lesson'], ['activity', 'exam'], ['exam', 'activity']] as const)('%s and %s resource conflicts roll back the complete batch, including for an owner', async (first, second) => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await expect(service.baseService.entities.resourceAssignments.batchSave([
      new ResourceAssignment({ id: 'first', resourceId: 'room', ...targets[first] }),
      new ResourceAssignment({ id: 'second', resourceId: 'room', ...targets[second] }),
    ])).rejects.toBeInstanceOf(BusinessRuleViolationError)
    expect(await fixture.repositories.resourceAssignments.count()).toBe(0)
  })

  test('adjacent reservations and untimed homework can share a resource in one batch', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_MANAGE)
    const exam = (await fixture.repositories.assessments.findById('exam'))!
    await fixture.repositories.assessments.save(new Assessment({ ...exam.data, startsAt: endsAt, endsAt: new Date('2026-05-01T10:00:00Z') }))
    await fixture.repositories.assessments.save(new Assessment({ ...exam.data, id: 'homework', kind: AssessmentKind.Homework, lessonSessionId: 'lesson', startsAt: undefined, endsAt: undefined, dueAt: new Date('2026-05-02') }))
    await service.baseService.entities.resourceAssignments.batchSave([
      new ResourceAssignment({ id: 'first', resourceId: 'room', lessonSessionId: 'lesson' }),
      new ResourceAssignment({ id: 'second', resourceId: 'room', assessmentId: 'exam' }),
      new ResourceAssignment({ id: 'third', resourceId: 'room', assessmentId: 'homework' }),
    ])
    expect(await fixture.repositories.resourceAssignments.count()).toBe(3)
  })

  test('class reservations and occurrence reservations enforce the same cross-class rule', async () => {
    await grant(Permission.RESOURCE_ASSIGNMENT_MANAGE)
    await service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: 'occurrence', resourceId: 'room', lessonSessionId: 'lesson' }))
    await expect(service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: 'class', resourceId: 'room', classGroupId: 'class-other' }))).rejects.toMatchObject({ code: 'RESOURCE_ALREADY_ASSIGNED_TO_CLASS' })
    await service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: 'class', resourceId: 'room', classGroupId: 'class-a' }))
    await expect(service.baseService.entities.resources.delete('room')).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.RESOURCE_CONFIGURE)
    await expect(service.baseService.entities.resources.delete('room')).rejects.toMatchObject({ code: 'RESOURCE_HAS_DEPENDENCIES' })
  })

  test.each(['teacher', 'guardian', 'student'] as const)('%s selection never inherits same-login owner resource authority', async (kind) => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'; UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
    const actor = kind === 'teacher' ? createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }) : kind === 'guardian' ? createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }) : createStudentActorMetadata({ ...identity, studentId: 'student-a' })
    service = new SchoolService({ commandJournal: new PostgresCommandJournal(), actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    await expect(service.baseService.entities.resources.list()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.resourceAssignments.save(new ResourceAssignment({ id: 'new', resourceId: 'room', lessonSessionId: 'lesson' }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
