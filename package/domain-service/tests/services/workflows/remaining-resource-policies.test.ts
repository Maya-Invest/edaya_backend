import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { GrantScope } from '@edaya/core'
import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createServiceStaffActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Activity, ActivityCategory, ActivityEnrollment, ActivityEnrollmentStatus, ClassActivityEnrollment, ClassSubject, corePermissionDefinition, GradeLevelSubject, GradeLevelSubjectMatter, noOpNotificationGateway, Permission, StaffMember, StaffPermissionAssignment, StudentHealthProfile, Subject, SubjectMatter, Teacher, TeacherAssignment, TeacherAssignmentKind, TeacherUnavailability, TeacherUnavailabilityRecurrence } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'resource-matrix', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })
const teacher = createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })
const guardian = createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' })
const student = createStudentActorMetadata({ ...identity, studentId: 'student-a' })

describe('remaining resource policies against native SQL and transactions', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
  })
  afterEach(async () => fixture.db.close())
  function service(actor: SchoolScopedActorMetadata = staff) {
    return new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
  }
  async function grant(permission: Permission, scopes?: GrantScope[]) {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission, scopes: scopes ?? (corePermissionDefinition(permission).scopePolicy.mode === 'resources' ? [{ kind: 'all', grain: 'class_group' }] : [{ kind: 'school' }]) }))
  }
  async function expire(permission: Permission) {
    const before = (await fixture.repositories.staffPermissionAssignments.findById(permission))!
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...before.data, endsAt: new Date('2000-01-01') }))
  }
  async function activities() {
    for (const id of ['club', 'other-club', 'foreign-club'])
      await fixture.repositories.activities.save(new Activity({ id, schoolId: id === 'foreign-club' ? 'school-b' : 'school-a', name: id, category: ActivityCategory.Arts, coach: 'Coach', schedule: 'Friday', participants: 0, capacity: 20, description: id, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))
  }
  async function health() {
    for (const [id, studentId, schoolId] of [['health-a', 'student-a', 'school-a'], ['health-other', 'student-other', 'school-a'], ['health-b', 'student-b', 'school-b']])
      await fixture.repositories.studentHealthProfiles.save(new StudentHealthProfile({ id: id!, studentId: studentId!, schoolId: schoolId!, clinicalNotes: 'Private' }))
  }
  async function availability() {
    await fixture.repositories.teachers.save(new Teacher({ id: 'teacher-other', schoolId: 'school-a', firstName: 'Other', lastName: 'Teacher' }))
    await fixture.repositories.teachers.save(new Teacher({ id: 'teacher-b', schoolId: 'school-b', firstName: 'Foreign', lastName: 'Teacher' }))
    for (const [id, teacherId, academicYearId] of [['own', 'teacher-a', 'year-a'], ['other', 'teacher-other', 'year-a'], ['old', 'teacher-a', 'year-old'], ['foreign', 'teacher-b', 'year-b']])
      await fixture.repositories.teacherUnavailabilities.save(new TeacherUnavailability({ id: id!, teacherId: teacherId!, academicYearId: academicYearId!, recurrence: TeacherUnavailabilityRecurrence.OneOff, startsAt: new Date(academicYearId === 'year-old' ? '2025-05-01T08:00Z' : '2026-05-01T08:00Z'), endsAt: new Date(academicYearId === 'year-old' ? '2025-05-01T09:00Z' : '2026-05-01T09:00Z') }))
  }

  test('health reads, single lookups and counts require health authority rather than general student access', async () => {
    await health()
    const entities = service().baseService.entities.studentHealthProfiles
    await grant(Permission.STUDENT_READ)
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.STUDENT_HEALTH_READ)
    expect((await entities.list()).map(row => row.id)).toEqual(['health-a', 'health-other'])
    expect(await entities.count()).toBe(2)
    expect((await entities.list({ $offset: 1, $limit: 1 })).map(row => row.id)).toEqual(['health-other'])
    expect(await entities.findById('health-b')).toBeUndefined()
    const before = (await fixture.repositories.studentHealthProfiles.findById('health-a'))!
    await expect(entities.save(new StudentHealthProfile({ ...before.data, clinicalNotes: 'Changed' }))).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.STUDENT_HEALTH_UPDATE)
    await entities.save(new StudentHealthProfile({ ...before.data, clinicalNotes: 'Changed' }))
    await expire(Permission.STUDENT_HEALTH_UPDATE)
    await expect(entities.delete(before.id)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each([teacher, guardian, student])('$kind health access never inherits a same-login owner or health grant', async (actor) => {
    await health()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await grant(Permission.STUDENT_HEALTH_READ)
    await grant(Permission.STUDENT_HEALTH_UPDATE)
    const entities = service(actor).baseService.entities.studentHealthProfiles
    await expect(entities.findById('health-a')).rejects.toBeInstanceOf(AuthorizationError)
    const before = (await fixture.repositories.studentHealthProfiles.findById('health-a'))!
    await expect(entities.save(before)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(entities.delete(before.id)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('health writes reject foreign targets, reassignment and a mixed batch before any mutation', async () => {
    await health()
    await grant(Permission.STUDENT_HEALTH_UPDATE)
    const entities = service().baseService.entities.studentHealthProfiles
    const before = (await fixture.repositories.studentHealthProfiles.findById('health-a'))!
    for (const proposal of [{ ...before.data, studentId: 'student-b' }, { ...before.data, studentId: 'student-other' }])
      await expect(entities.save(new StudentHealthProfile(proposal))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(entities.batchSave([new StudentHealthProfile({ ...before.data, clinicalNotes: 'Changed' }), new StudentHealthProfile({ id: 'new', schoolId: 'school-a', studentId: 'student-b' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.studentHealthProfiles.findById(before.id))?.clinicalNotes).toBe('Private')
    await expect(service({ ...staff, academicYearId: 'year-old' }).baseService.entities.studentHealthProfiles.list()).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('staff without directory grants can read their selected profile but not colleagues', async () => {
    await fixture.db.exec(`INSERT INTO staff_members (id, school_id, first_name, last_name, is_active, created_at) VALUES ('staff-other', 'school-a', 'Other', 'Staff', true, now())`)
    const entities = service().baseService.entities.staffMembers
    expect((await entities.findById('staff-a'))?.id).toBe('staff-a')
    expect(await entities.findById('staff-other')).toBeUndefined()
    expect((await entities.list()).map(row => row.id)).toEqual(['staff-a'])
    const before = (await fixture.repositories.staffMembers.findById('staff-a'))!
    await expect(entities.save(before)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('teacher availability self reads exclude other teachers but cannot alter scheduling constraints', async () => {
    await availability()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const entities = service(teacher).baseService.entities.teacherUnavailabilities
    expect((await entities.list()).map(row => row.id)).toEqual(['old', 'own'])
    expect(await entities.count()).toBe(2)
    expect(await entities.findById('other')).toBeUndefined()
    expect(await entities.findById('foreign')).toBeUndefined()
    const before = (await fixture.repositories.teacherUnavailabilities.findById('own'))!
    await expect(entities.save(new TeacherUnavailability({ ...before.data, reason: 'Changed' }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(entities.delete('own')).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.db.exec('UPDATE teachers SET is_active = false WHERE id = \'teacher-a\'')
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('availability administration binds its action and year to old, proposed and batch records', async () => {
    await availability()
    await grant(Permission.STAFF_READ)
    const entities = service().baseService.entities.teacherUnavailabilities
    expect((await entities.list()).map(row => row.id)).toEqual(['other', 'own'])
    const before = (await fixture.repositories.teacherUnavailabilities.findById('own'))!
    await expect(entities.save(before)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACCESS_CONTROL_MANAGE)
    await entities.save(new TeacherUnavailability({ ...before.data, reason: 'Changed' }))
    for (const proposal of [{ ...before.data, teacherId: 'teacher-b' }, { ...before.data, academicYearId: 'year-old' }, { ...before.data, id: 'old' }])
      await expect(entities.save(new TeacherUnavailability(proposal))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(entities.batchSave([new TeacherUnavailability({ ...before.data, reason: 'Rolled back' }), new TeacherUnavailability({ ...before.data, id: 'new', teacherId: 'teacher-b' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.teacherUnavailabilities.findById('own'))?.reason).toBe('Changed')
    await expire(Permission.ACCESS_CONTROL_MANAGE)
    await expect(entities.delete('own')).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each([guardian, student])('$kind activity visibility follows approved enrollment and current family links', async (actor) => {
    await activities()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    for (const action of [Permission.ACTIVITY_ENROLLMENT_MANAGE])
      await grant(action, [{ kind: 'all', grain: 'activity' }])
    for (const [id, activityId, studentId, status] of [['own', 'club', 'student-a', ActivityEnrollmentStatus.Approved], ['pending', 'other-club', 'student-a', ActivityEnrollmentStatus.Pending], ['other', 'other-club', 'student-other', ActivityEnrollmentStatus.Approved]] as const)
      await fixture.repositories.activityEnrollments.save(new ActivityEnrollment({ id, activityId, studentId, status }))
    const entities = service(actor).baseService.entities
    expect((await entities.activities.list()).map(row => row.id)).toEqual(['club'])
    expect(await entities.activities.count()).toBe(1)
    expect(await entities.activities.findById('other-club')).toBeUndefined()
    expect(await entities.activities.findById('foreign-club')).toBeUndefined()
    expect((await entities.activityEnrollments.list()).map(row => row.id)).toEqual(['own', 'pending'])
    expect(await entities.activityEnrollments.count()).toBe(2)
    expect(await entities.activityEnrollments.list({ $offset: 2, $limit: 1 })).toEqual([])
    const own = (await fixture.repositories.activityEnrollments.findById('own'))!
    await expect(entities.activityEnrollments.save(new ActivityEnrollment({ ...own.data, status: ActivityEnrollmentStatus.Denied }))).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.activityEnrollments.save(new ActivityEnrollment({ ...own.data, status: ActivityEnrollmentStatus.Denied }))
    expect(await entities.activities.count()).toBe(0)
    if (actor.kind === 'guardian') {
      await fixture.repositories.guardianLinks.delete('guardian-link')
      expect(await entities.activityEnrollments.count()).toBe(0)
    }
  })

  test('activity roster exposes bounded identities and eligible students without dossier authority', async () => {
    await activities()
    for (const [id, activityId, classGroupId] of [['a', 'club', 'class-a'], ['other', 'club', 'class-other'], ['b', 'other-club', 'class-other']] as const)
      await fixture.repositories.classActivityEnrollments.save(new ClassActivityEnrollment({ id, activityId, classGroupId }))
    await grant(Permission.ACTIVITY_READ, [{ kind: 'activity', activityId: 'club', classGroupId: 'class-a' }])
    await grant(Permission.ACTIVITY_ENROLLMENT_MANAGE, [{ kind: 'activity', activityId: 'club', classGroupId: 'class-a' }, { kind: 'activity', activityId: 'other-club', classGroupId: 'class-other' }])
    const roster = await service().getActivityRoster({ activityId: 'club' })
    expect(roster.eligibleStudentIds).toEqual(['student-a'])
    expect(roster.classes.map(row => row.id)).toEqual(['class-a'])
    expect(roster.students).toEqual([{ id: 'student-a', firstName: expect.any(String), lastName: expect.any(String), matricule: undefined, classGroupId: 'class-a' }])
    await expect(service().baseService.entities.students.findById('student-a')).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service().getActivityRoster({ activityId: 'foreign-club' })).rejects.toBeInstanceOf(AuthorizationError)
    await expire(Permission.ACTIVITY_ENROLLMENT_MANAGE)
    expect((await service().getActivityRoster({ activityId: 'club' })).eligibleStudentIds).toEqual([])
    await expire(Permission.ACTIVITY_READ)
    await expect(service().getActivityRoster({ activityId: 'club' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('student activity enrollment separates reads from enrollment management and rejects foreign batches', async () => {
    await activities()
    const entities = service().baseService.entities.activityEnrollments
    const own = new ActivityEnrollment({ id: 'own', activityId: 'club', studentId: 'student-a', status: ActivityEnrollmentStatus.Pending })
    await grant(Permission.ACTIVITY_READ, [{ kind: 'activity', activityId: 'club' }])
    await expect(entities.save(own)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACTIVITY_ENROLLMENT_MANAGE, [{ kind: 'activity', activityId: 'club' }])
    await entities.save(own)
    await grant(Permission.ACTIVITY_ENROLLMENT_MANAGE, [{ kind: 'activity', activityId: 'club' }])
    await entities.save(new ActivityEnrollment({ ...own.data, status: ActivityEnrollmentStatus.Approved }))
    await expect(entities.batchSave([new ActivityEnrollment({ ...own.data, id: 'valid-new' }), new ActivityEnrollment({ ...own.data, id: 'foreign', studentId: 'student-b' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await entities.count()).toBe(1)
    await expect(entities.save(new ActivityEnrollment({ ...own.data, activityId: 'foreign-club' }))).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACTIVITY_ENROLLMENT_MANAGE, [{ kind: 'activity', activityId: 'club' }])
    await entities.delete(own.id)
    expect(await entities.count()).toBe(0)
  })

  test('class activity placement constrains reads and every old/proposed write without action mixing', async () => {
    await activities()
    for (const [id, classGroupId, activityId] of [['own', 'class-a', 'club'], ['other', 'class-other', 'club'], ['foreign', 'class-b', 'foreign-club']] as const)
      await fixture.repositories.classActivityEnrollments.save(new ClassActivityEnrollment({ id, classGroupId, activityId }))
    await grant(Permission.ACTIVITY_READ, [{ kind: 'class_group', classGroupId: 'class-a' }])
    await grant(Permission.ACTIVITY_MANAGE, [{ kind: 'activity', classGroupId: 'class-other' }])
    const entities = service().baseService.entities.classActivityEnrollments
    expect((await entities.list()).map(row => row.id)).toEqual(['other', 'own'])
    expect(await entities.count()).toBe(2)
    expect(await entities.findById('foreign')).toBeUndefined()
    const own = (await fixture.repositories.classActivityEnrollments.findById('own'))!
    await expect(entities.save(new ClassActivityEnrollment({ ...own.data, classGroupId: 'class-other' }))).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACTIVITY_MANAGE, [{ kind: 'activity', classGroupId: 'class-a' }])
    await expect(entities.save(new ClassActivityEnrollment({ ...own.data, classGroupId: 'class-other' }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(entities.save(new ClassActivityEnrollment({ ...own.data, classGroupId: 'class-old' }))).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACTIVITY_MANAGE, [{ kind: 'activity', classGroupId: 'class-a' }])
    await expect(entities.batchSave([new ClassActivityEnrollment({ id: 'new', activityId: 'other-club', classGroupId: 'class-a' }), new ClassActivityEnrollment({ id: 'bad', activityId: 'foreign-club', classGroupId: 'class-a' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.classActivityEnrollments.findById('new')).toBeUndefined()
  })

  test('homeroom and family class activity reads differ from subject-only teaching and revoke immediately', async () => {
    await activities()
    const activity = (await fixture.repositories.activities.findById('club'))!
    await fixture.repositories.activities.save(new Activity({ ...activity.data, id: 'private-club' }))
    await fixture.repositories.activities.save(new Activity({ ...activity.data, id: 'old-club' }))
    await fixture.repositories.classActivityEnrollments.save(new ClassActivityEnrollment({ id: 'old', classGroupId: 'class-old', activityId: 'old-club' }))
    for (const [id, classGroupId] of [['own', 'class-a'], ['other', 'class-other']] as const)
      await fixture.repositories.classActivityEnrollments.save(new ClassActivityEnrollment({ id, classGroupId, activityId: id === 'own' ? 'club' : 'private-club' }))
    expect(await service(teacher).baseService.entities.classActivityEnrollments.count()).toBe(0)
    await fixture.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-a', academicYearId: 'year-a', kind: TeacherAssignmentKind.Homeroom, classGroupId: 'class-a' }))
    await grant(Permission.ACTIVITY_READ, [{ kind: 'class_group', classGroupId: 'class-a' }])
    for (const actor of [teacher, staff]) {
      const activities = service(actor).baseService.entities.activities
      expect((await activities.list()).map(row => row.id)).toEqual(['club', 'other-club'])
      expect(await activities.count()).toBe(2)
      expect(await activities.findById('private-club')).toBeUndefined()
      expect(await activities.findById('foreign-club')).toBeUndefined()
    }
    for (const actor of [teacher, guardian, student]) {
      const entities = service(actor).baseService.entities.classActivityEnrollments
      expect((await entities.list()).map(row => row.id)).toEqual(['own'])
      await expect(entities.delete('own')).rejects.toBeInstanceOf(AuthorizationError)
    }
    await fixture.repositories.teacherAssignments.delete('homeroom')
    expect(await service(teacher).baseService.entities.classActivityEnrollments.count()).toBe(0)
    expect(await service(teacher).baseService.entities.activities.count()).toBe(0)
    await grant(Permission.ACTIVITY_READ, [{ kind: 'all', grain: 'class_group' }])
    expect((await service().baseService.entities.activities.list()).map(row => row.id)).toEqual(['club', 'other-club', 'private-club'])
    await grant(Permission.ACTIVITY_READ, [{ kind: 'class_group', classGroupId: 'missing-class' }])
    expect(await service().baseService.entities.activities.count()).toBe(0)
  })

  async function curriculum() {
    await fixture.repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'grade-math', academicYearId: 'year-a', gradeLevelId: 'level-a', subjectId: 'math' }))
    await fixture.repositories.gradeLevelSubjects.save(new GradeLevelSubject({ id: 'grade-foreign', academicYearId: 'year-b', gradeLevelId: 'level-b', subjectId: 'foreign-math' }))
    for (const [id, gradeLevelSubjectId] of [['math-a', 'grade-math'], ['math-other', 'grade-math'], ['math-b', 'grade-foreign']] as const) {
      const before = (await fixture.repositories.classSubjects.findById(id))!
      await fixture.repositories.classSubjects.save(new ClassSubject({ ...before.data, gradeLevelSubjectId }))
    }
    for (const [id, subjectId] of [['matter', 'math'], ['other-matter', 'math'], ['foreign-matter', 'foreign-math']] as const)
      await fixture.repositories.subjectMatters.save(new SubjectMatter({ id, subjectId, name: id, sequenceOrder: 1 }))
    for (const [id, gradeLevelSubjectId, subjectMatterId] of [['own', 'grade-math', 'matter'], ['foreign', 'grade-foreign', 'foreign-matter']] as const)
      await fixture.repositories.gradeLevelSubjectMatters.save(new GradeLevelSubjectMatter({ id, gradeLevelSubjectId, subjectMatterId }))
  }

  test('shared grade curriculum reads preserve linked class scope and foreign isolation', async () => {
    await curriculum()
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'class_group', classGroupId: 'class-a' }])
    for (const actor of [staff, teacher, guardian, student]) {
      const entities = service(actor).baseService.entities.gradeLevelSubjectMatters
      expect((await entities.list()).map(row => row.id)).toEqual(['own'])
      expect(await entities.count()).toBe(1)
      expect(await entities.list({ $offset: 1, $limit: 1 })).toEqual([])
      expect(await entities.findById('foreign')).toBeUndefined()
      const own = (await fixture.repositories.gradeLevelSubjectMatters.findById('own'))!
      await expect(entities.save(own)).rejects.toBeInstanceOf(AuthorizationError)
    }
    await fixture.repositories.teacherAssignments.delete('teaching')
    expect(await service(teacher).baseService.entities.gradeLevelSubjectMatters.count()).toBe(0)
  })

  test('changing shared curriculum requires update authority for every affected class', async () => {
    await curriculum()
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }])
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'class_group', classGroupId: 'class-other' }])
    const entities = service().baseService.entities.gradeLevelSubjectMatters
    const own = (await fixture.repositories.gradeLevelSubjectMatters.findById('own'))!
    const changed = new GradeLevelSubjectMatter({ ...own.data, subjectMatterId: 'other-matter' })
    await expect(entities.save(changed)).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.gradeLevelSubjectMatters.findById('own'))?.subjectMatterId).toBe('matter')
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }, { kind: 'class_group', classGroupId: 'class-other' }])
    await entities.save(changed)
    expect((await fixture.repositories.gradeLevelSubjectMatters.findById('own'))?.subjectMatterId).toBe('other-matter')
    await expire(Permission.ACADEMIC_PROGRAM_MANAGE)
    await expect(entities.save(own)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each(['subjects', 'subjectMatters', 'gradeLevelSubjects'] as const)('%s shared details cannot be changed through authority for only one consumer class', async (resource) => {
    await curriculum()
    const entities = service().baseService.entities
    const subject = (await fixture.repositories.subjects.findById('math'))!
    const matter = (await fixture.repositories.subjectMatters.findById('matter'))!
    const grade = (await fixture.repositories.gradeLevelSubjects.findById('grade-math'))!
    const change = {
      subjects: () => entities.subjects.save(new Subject({ ...subject.data, name: 'Changed' })),
      subjectMatters: () => entities.subjectMatters.save(new SubjectMatter({ ...matter.data, name: 'Changed' })),
      gradeLevelSubjects: () => entities.gradeLevelSubjects.save(new GradeLevelSubject({ ...grade.data, coefficient: 2 })),
    }[resource]
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }])
    await expect(change()).rejects.toBeInstanceOf(AuthorizationError)
    if (resource === 'gradeLevelSubjects')
      await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'all', grain: 'class_group' }])
    else
      await grant(Permission.ACADEMIC_CATALOG_MANAGE)
    await change()
    expect(resource === 'subjects'
      ? (await fixture.repositories.subjects.findById('math'))?.name
      : resource === 'subjectMatters'
        ? (await fixture.repositories.subjectMatters.findById('matter'))?.name
        : (await fixture.repositories.gradeLevelSubjects.findById('grade-math'))?.coefficient).toBe(resource === 'gradeLevelSubjects' ? 2 : 'Changed')
  })

  test('grade curriculum management covers creation and deletion and rolls back mixed foreign batches', async () => {
    await curriculum()
    const entities = service().baseService.entities.gradeLevelSubjectMatters
    const proposal = new GradeLevelSubjectMatter({ id: 'new', gradeLevelSubjectId: 'grade-math', subjectMatterId: 'other-matter' })
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'all', grain: 'class_group' }])
    await expect(entities.save(proposal)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE)
    await expect(entities.batchSave([proposal, new GradeLevelSubjectMatter({ id: 'bad', gradeLevelSubjectId: 'grade-foreign', subjectMatterId: 'foreign-matter' })])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.gradeLevelSubjectMatters.findById('new')).toBeUndefined()
    await entities.save(proposal)
    await expect(entities.batchDelete(['new', 'foreign'])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.gradeLevelSubjectMatters.findById('new')).toBeDefined()
    await entities.delete('new')
    expect(await fixture.repositories.gradeLevelSubjectMatters.findById('new')).toBeUndefined()
  })

  test('a service account uses explicit health grants and cannot infer authority from the owner login', async () => {
    await health()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const before = (await fixture.repositories.staffMembers.findById('staff-a'))!
    await fixture.repositories.staffMembers.save(new StaffMember({ ...before.data, accountKind: 'service', subjectId: undefined, serviceId: 'health-integration' }))
    const entities = service(createServiceStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })).baseService.entities.studentHealthProfiles
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.STUDENT_HEALTH_READ)
    expect(await entities.count()).toBe(2)
    expect(await entities.findById('health-b')).toBeUndefined()
    await expire(Permission.STUDENT_HEALTH_READ)
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
  })
})
