import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { GrantScope } from '@edaya/core'
import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createServiceStaffActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Activity, ActivityCategory, ActivityEnrollment, ActivityEnrollmentStatus, ClassActivityEnrollment, corePermissionDefinition, noOpNotificationGateway, Permission, StaffMember, StaffPermissionAssignment, StudentHealthProfile, Subject, SubjectMatter, Teacher, TeacherAssignment, TeacherAssignmentKind, TeacherUnavailability, TeacherUnavailabilityRecurrence, withShortName } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { saveHumanFixture } from '../../../../../tooling/test-support/human-fixtures'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

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
  afterEach(async () => releaseDatabase(fixture.db))
  function service(actor: SchoolScopedActorMetadata = staff) {
    return new SchoolService({ commandJournal: new PostgresCommandJournal(), actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
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
      await fixture.repositories.activities.save(new Activity(withShortName({ id, schoolId: id === 'foreign-club' ? 'school-b' : 'school-a', name: id, category: ActivityCategory.Arts, coach: 'Coach', schedule: 'Friday', participants: 0, capacity: 20, description: id, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })))
  }
  async function health() {
    for (const [id, studentId, schoolId] of [['health-a', 'student-a', 'school-a'], ['health-other', 'student-other', 'school-a'], ['health-b', 'student-b', 'school-b']])
      await fixture.repositories.studentHealthProfiles.save(new StudentHealthProfile({ id: id!, studentId: studentId!, schoolId: schoolId!, clinicalNotes: 'Private' }))
  }
  async function availability() {
    await saveHumanFixture(fixture.repositories.teachers, new Teacher({ id: 'teacher-other', schoolId: 'school-a', firstName: 'Other', lastName: 'Teacher' }))
    await saveHumanFixture(fixture.repositories.teachers, new Teacher({ id: 'teacher-b', schoolId: 'school-b', firstName: 'Foreign', lastName: 'Teacher' }))
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
    await fixture.db.exec(`INSERT INTO staff_members (id, identifier, school_id, first_name, last_name, is_active, created_at) VALUES ('staff-other', 'STAFF-OTHER', 'school-a', 'Other', 'Staff', true, now())`)
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

  test('teacher logbook pages visible notes and chapters in the current offering', async () => {
    const app = service(teacher)
    const query = { classGroupId: 'class-a', classSubjectId: 'math-a', view: 'recorded' as const }
    expect(await app.getTeacherLogbook(query)).toEqual({ items: [], nextCursor: null })
    await fixture.db.exec(`
      insert into lesson_sessions(id, school_id, class_group_id, class_subject_id, status, is_exception, starts_at, ends_at, calendar_date, display_label, session_note, created_at)
      select 's'||lpad(i::text,2,'0'), 'school-a','class-a','math-a','completed',false,
        timestamp '2026-01-01 09:00:00' + (i/2)*interval '1 microsecond',now(),now(),'Lesson '||i,
        case when i=0 then null when i=1 then '{"edayaLogbook":{"content":""}}' when i<5 then E' \t' else 'Plain note' end,now() from generate_series(0,34) i;
      insert into class_subject_matters(id,class_subject_id,subject_matter_id,updated_at) values ('chapter-a','math-a','a',now()),('chapter-b','math-other','b',now());
      insert into class_subject_progress(id,lesson_session_id,class_subject_matter_id,completed,recorded_at) values
        ('chapter-only','s00','chapter-a',false,now()),('mismatched-offering','s02','chapter-b',true,now());
    `)
    const first = await app.getTeacherLogbook(query)
    expect(first.items.map(row => row.id)).toEqual(Array.from({ length: 30 }, (_, i) => `s${String(34 - i).padStart(2, '0')}`))
    expect(first.items.every(row => row.recorded)).toBe(true)
    expect(first.items[0]?.startsAt).toBe('2026-01-01T09:00:00.000017Z')
    const next = { ...query, cursor: first.nextCursor! }
    expect((await app.getTeacherLogbook(next)).items.map(row => row.id)).toEqual(['s01', 's00'])
    expect((await app.getTeacherLogbook(next)).nextCursor).toBeNull()
    await expect(app.getTeacherLogbook({ ...next, view: 'all' })).rejects.toThrow('Invalid teacher logbook cursor')
    await expect(app.getTeacherLogbook({ ...query, cursor: 'invalid' })).rejects.toThrow('Invalid teacher logbook cursor')
    const all = await app.getTeacherLogbook({ ...query, view: 'all' })
    const tail = await app.getTeacherLogbook({ ...query, cursor: all.nextCursor!, view: 'all' })
    expect(tail.items.map(r => [r.id, r.recorded])).toEqual([['s04', false], ['s03', false], ['s02', false], ['s01', true], ['s00', true]])
    await fixture.db.exec('update lesson_sessions set session_note=\'Saved note\' where id=\'s04\'')
    expect((await app.getTeacherLogbook(next)).items[0]?.id).toBe('s04')
    for (const selection of [{ classSubjectId: 'french-a' }, { classGroupId: 'class-other' }, { classSubjectId: 'math-b', classGroupId: 'class-b' }])
      await expect(app.getTeacherLogbook({ ...query, ...selection })).rejects.toBeInstanceOf(AuthorizationError)
    const archivedYear = createTeacherActorMetadata({ ...identity, academicYearId: 'year-old', teacherId: 'teacher-a' })
    for (const other of [staff, guardian, student, archivedYear])
      await expect(service(other).getTeacherLogbook(query)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.db.exec('update teachers set is_active=false where id=\'teacher-a\'')
    await expect(app.getTeacherLogbook(next)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.db.exec('update teachers set is_active=true where id=\'teacher-a\'')
    await fixture.db.exec('update teacher_assignments set status=\'ended\' where id=\'teaching\'')
    await expect(app.getTeacherLogbook(next)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('guardian child profile selects the current photo decision and pages only downloadable family papers', async () => {
    const app = service(guardian)
    const input = { studentId: 'student-a', academicYearId: 'year-a' }
    await fixture.db.exec(`
      insert into student_photo_submissions(id,school_id,student_id,attachment_id,submitter_guardian_id,status,version,reviewed_at,rejection_reason,created_at,updated_at)
      select 'photo-'||lpad(i::text,2,'0'),'school-a','student-a','file-'||i,'guardian-a',case when i=51 then 'pending' else 'rejected' end,2,
      timestamp '2026-10-01', 'reason-'||i, timestamp '2026-09-01',timestamp '2026-10-01' from generate_series(1,51) i;
      insert into document_issuances(id,school_id,template_key,template_version,locale,academic_year_id,source_type,source_id,source_version,student_id,snapshot,issuer_actor_id,audience,request_id,status,created_at)
      select 'doc-'||lpad(i::text,2,'0'),'school-a',case when i=35 then 'report-card.v1' else 'schooling-certificate.v1' end,'1','fr',
      case when i=36 then 'year-old' else 'year-a' end,'enrollment','source-'||i,'1',case when i=37 then 'student-other' else 'student-a' end,
      '{"facts":{},"sourceVersion":"1","locale":"fr","timeZone":"UTC"}','issuer','family','request-'||i,case when i=34 then 'superseded' else 'ready' end,now()
      from generate_series(1,37) i
    `)
    expect((await app.getGuardianChildPhoto(input)).decision).toEqual({ status: 'pending', ownSubmission: { id: 'photo-51', attachmentId: 'file-51', version: 2 } })
    await fixture.db.exec('update student_photo_submissions set submitter_guardian_id=\'other-parent\' where id=\'photo-51\'')
    expect((await app.getGuardianChildPhoto(input)).decision).toEqual({ status: 'pending', ownSubmission: null })
    await fixture.db.exec('update student_photo_submissions set status=\'withdrawn\' where id=\'photo-51\'')
    expect((await app.getGuardianChildPhoto(input)).decision).toEqual({ status: 'rejected', reason: 'reason-50' })
    await fixture.db.exec('update student_photo_submissions set reviewed_at=\'2026-10-03\',submitter_guardian_id=\'other-parent\' where id=\'photo-01\'')
    expect((await app.getGuardianChildPhoto(input)).decision).toEqual({ status: 'none' })
    await fixture.db.exec('update student_photo_submissions set status=\'approved\',submitter_guardian_id=\'guardian-a\' where id=\'photo-01\'')
    expect((await app.getGuardianChildPhoto(input)).decision).toEqual({ status: 'none' })
    const first = await app.getGuardianPapers(input)
    expect(first.items).toHaveLength(30)
    const next = await app.getGuardianPapers({ ...input, cursor: first.nextCursor! })
    expect(next.nextCursor).toBeNull()
    expect([...first.items, ...next.items].map(r => r.id)).toEqual(Array.from({ length: 33 }, (_, i) => `doc-${String(i + 1).padStart(2, '0')}`))
    expect(first.items[0]).not.toHaveProperty('snapshot')
    await expect(app.getGuardianPapers({ ...input, cursor: 'invalid' })).rejects.toThrow('Invalid family paper cursor')
    for (const inaccessible of [{ ...input, studentId: 'student-other' }, { ...input, academicYearId: 'year-old' }]) {
      await expect(app.getGuardianChildPhoto(inaccessible)).rejects.toBeInstanceOf(AuthorizationError)
      await expect(app.getGuardianPapers(inaccessible)).rejects.toBeInstanceOf(AuthorizationError)
    }
    for (const actor of [teacher, student, staff]) {
      await expect(service(actor).getGuardianChildPhoto(input)).rejects.toBeInstanceOf(AuthorizationError)
      await expect(service(actor).getGuardianPapers(input)).rejects.toBeInstanceOf(AuthorizationError)
    }
    await fixture.db.exec('update guardians set has_access=false where id=\'guardian-a\'')
    await expect(app.getGuardianChildPhoto(input)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(app.getGuardianPapers(input)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.db.exec('update guardians set has_access=true where id=\'guardian-a\'')
    await fixture.db.exec('delete from guardian_student_links where id=\'guardian-link\'')
    await expect(app.getGuardianPapers({ ...input, cursor: first.nextCursor! })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(app.getGuardianChildPhoto(input)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('incident lesson options preserve class authority, selection and literal search across pages', async () => {
    const app = service()
    const input = { classGroupId: 'class-a' }
    await fixture.db.exec(`
      insert into lesson_sessions(id,school_id,class_group_id,class_subject_id,status,is_exception,starts_at,ends_at,calendar_date,display_label,created_at)
      select 's'||lpad(i::text,2,'0'), 'school-a', case when i=35 then 'class-other' else 'class-a' end,
        case when i=35 then 'math-other' else 'math-a' end,'completed',false,
        timestamp '2026-10-07 09:00',timestamp '2026-10-07 10:00',date '2026-10-07',
        case when i=34 then 'Rare 50%_offer' else 'Math' end,now() from generate_series(1,35) i
    `)
    await expect(app.getIncidentLessonOptions(input)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.TIMETABLE_READ, [{ kind: 'class_group', classGroupId: 'class-a' }])
    const first = await app.getIncidentLessonOptions({ ...input, selectedId: 's34' })
    expect(first.items.map(row => row.id)).toEqual(Array.from({ length: 30 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`))
    expect(first.selected).toEqual({ id: 's34', displayLabel: 'Rare 50%_offer', startsAt: '2026-10-07T09:00:00.000Z' })
    const next = await app.getIncidentLessonOptions({ ...input, cursor: first.nextCursor!, selectedId: 's35' })
    expect(next.items.map(row => row.id)).toEqual(['s31', 's32', 's33', 's34'])
    expect(next.selected).toBeNull()
    expect(next.nextCursor).toBeNull()
    expect(await app.getIncidentLessonOptions({ classGroupId: 'class-other', selectedId: 's35' })).toEqual({ items: [], selected: null, nextCursor: null })
    expect((await app.getIncidentLessonOptions({ ...input, q: '%_OFFER' })).items).toEqual([first.selected!])
    expect((await app.getIncidentLessonOptions({ ...input, q: '09:00:00', selectedId: 'missing' })).selected).toBeNull()
    expect((await app.getIncidentLessonOptions({ ...input, q: '2026-10-07' })).items).toHaveLength(30)
    for (const variant of [{ q: 'rare' }, { classGroupId: 'class-other' }])
      await expect(app.getIncidentLessonOptions({ ...input, ...variant, cursor: first.nextCursor! })).rejects.toThrow('Invalid incident lesson cursor')
    for (const actor of [student, guardian, teacher])
      await expect(service(actor).getIncidentLessonOptions(input)).rejects.toBeInstanceOf(AuthorizationError)
    await expire(Permission.TIMETABLE_READ)
    await expect(app.getIncidentLessonOptions({ ...input, cursor: first.nextCursor! })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('staff activity pages and exports count only memberships visible in the selected grant', async () => {
    await activities()
    const app = service()
    const filter = { category: 'Arts' }
    await expect(app.getStaffActivityList(filter)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACTIVITY_READ, [{ kind: 'activity', activityId: 'club', classGroupId: 'class-a' }])
    for (const classGroupId of ['class-a', 'class-other'])
      await fixture.repositories.classActivityEnrollments.save(new ClassActivityEnrollment({ id: classGroupId, activityId: 'club', classGroupId }))
    for (const [id, studentId, status] of [['own', 'student-a', ActivityEnrollmentStatus.Pending], ['other', 'student-other', ActivityEnrollmentStatus.Denied]] as const)
      await fixture.repositories.activityEnrollments.save(new ActivityEnrollment({ id, activityId: 'club', studentId, status }))
    const page = await app.getStaffActivityList(filter)
    expect(page).toEqual({ items: [expect.objectContaining({ id: 'club', enrollmentCount: 1 })], total: 1, nextCursor: null })
    expect((await app.getStaffActivityProfile({ activityId: 'club' })).activity).toEqual(page.items[0]!)
    expect((await app.getStaffActivityProfile({ activityId: 'other-club' })).activity).toBeNull()
    expect((await app.getStaffActivityProfile({ activityId: 'foreign-club' })).activity).toBeNull()
    const { membership } = await app.getActivityRoster({ activityId: 'club', includeMemberships: true })
    expect(membership).toEqual({ enrollments: [{ id: 'own', studentId: 'student-a', status: ActivityEnrollmentStatus.Pending }], linkedClassIds: ['class-a'] })
    expect(await app.getActivityRoster({ activityId: 'club' })).not.toHaveProperty('membership')
    await grant(Permission.TIMETABLE_READ, [{ kind: 'class_group', classGroupId: 'class-other' }])
    const mixed = await app.getActivityRoster({ activityId: 'club', includeMemberships: true })
    const entities = app.baseService.entities
    expect(mixed.membership?.enrollments.map(r => r.id)).toEqual((await entities.activityEnrollments.list({ activityId: 'club' })).map(r => r.id))
    expect(mixed.membership?.linkedClassIds).toEqual((await entities.classActivityEnrollments.list({ activityId: 'club' })).map(r => r.classGroupId))
    expect(mixed.students.some(r => r.id === 'student-other')).toBe(false)
    const members = await app.getStaffActivityMembers({ activityId: 'club', selectedId: 'other' })
    expect(members.total).toBe(2)
    expect(members.selected).toMatchObject({ id: 'other', student: null })
    expect(members.items.find(row => row.id === 'own')?.student).toMatchObject({ id: 'student-a', classGroupId: null })
    expect(members.canAdd).toBe(false)
    await expect(service(guardian).getStaffActivityMembers({ activityId: 'club' })).rejects.toBeInstanceOf(AuthorizationError)
    await expire(Permission.TIMETABLE_READ)
    expect((await app.getStaffActivityListExport(filter)).items).toEqual(page.items)
    expect((await app.getStaffActivityList({ q: 'other-club' })).total).toBe(0)
    await expect(app.getStaffActivityList({ cursor: '' })).rejects.toThrow('cursor')
    await expire(Permission.ACTIVITY_READ)
    await expect(app.getStaffActivityListExport(filter)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service(guardian).getStaffActivityList(filter)).rejects.toBeInstanceOf(AuthorizationError)
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
    const input = { activityId: 'club' }
    const options = await service().getStaffActivityPupilOptions(input)
    expect(options.classGroupIds).toEqual(['class-a'])
    expect(options.items.map(row => row.id)).toEqual(['student-a'])
    expect((await service().getStaffActivityPupilOptions({ ...input, classGroupId: 'class-other' })).items).toEqual([])
    expect((await service().getStaffActivityMembers(input)).canAdd).toBe(true)
    await expect(service(teacher).getStaffActivityPupilOptions(input)).rejects.toBeInstanceOf(AuthorizationError)
    expect(roster.students).toEqual([{ id: 'student-a', firstName: expect.any(String), lastName: expect.any(String), identifier: 'STUDENT-A', classGroupId: 'class-a' }])
    await expect(service().baseService.entities.students.findById('student-a')).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service().getActivityRoster({ activityId: 'foreign-club' })).rejects.toBeInstanceOf(AuthorizationError)
    await expire(Permission.ACTIVITY_ENROLLMENT_MANAGE)
    expect((await service().getActivityRoster({ activityId: 'club' })).eligibleStudentIds).toEqual([])
    expect(await service().getStaffActivityPupilOptions(input)).toEqual({ items: [], classGroupIds: [], nextClassCursor: null, nextCursor: null })
    expect((await service().getStaffActivityMembers(input)).canAdd).toBe(false)
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
    await fixture.repositories.activities.save(new Activity(withShortName({ ...activity.data, id: 'private-club' })))
    await fixture.repositories.activities.save(new Activity(withShortName({ ...activity.data, id: 'old-club' })))
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
    for (const [id, subjectId] of [['matter', 'math'], ['other-matter', 'math'], ['foreign-matter', 'foreign-math']] as const)
      await fixture.repositories.subjectMatters.save(new SubjectMatter(withShortName({ id, subjectId, name: id, sequenceOrder: 1 })))
  }

  test('subject scopes work before classes and isolate subject, grade, year and school', async () => {
    await fixture.db.exec('INSERT INTO grade_levels (id, school_id, name, short_name, order_val, created_at) VALUES (\'empty-grade\', \'school-a\', \'Empty\', \'Empty\', 2, now())')
    await fixture.db.exec('INSERT INTO academic_disciplines (id, school_id, short_name, name, created_at, updated_at) VALUES (\'test-discipline\', \'school-a\', \'TEST\', \'Test discipline\', now(), now())')
    const input = { disciplineId: 'test-discipline', id: 'empty-math', schoolId: 'school-a', gradeLevelId: 'empty-grade', academicYearId: 'year-a', name: 'Math', categoryId: 'category-school-a-scientific' }
    const existing = (await fixture.repositories.subjects.findById('math'))!
    input.categoryId = existing.categoryId
    for (const permission of [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_MANAGE])
      await grant(permission, [{ kind: 'subject', gradeLevelId: 'empty-grade' }])
    await service().academicsWorkflow.configureSubject(input)
    await service().academicsWorkflow.configureSubject({ ...input, id: 'empty-math-2' })
    expect(await fixture.repositories.classSubjects.count({ subjectId: input.id })).toBe(0)
    expect((await service().baseService.entities.subjects.list()).map(row => row.id).sort()).toEqual(['empty-math', 'empty-math-2'])
    await fixture.repositories.subjects.save(new Subject(withShortName({ ...input, id: 'old-math', academicYearId: 'year-old' })))
    expect(await service().baseService.entities.subjects.count()).toBe(2)
    for (const permission of [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_MANAGE])
      await grant(permission, [{ kind: 'subject', gradeLevelId: 'empty-grade', subjectId: input.id }])
    expect((await service().baseService.entities.subjects.list()).map(row => row.id)).toEqual([input.id])
    await service().academicsWorkflow.updateSubject({ subjectId: input.id, name: 'Updated' })
    for (const subjectId of ['empty-math-2', 'old-math', 'math', 'foreign-math'])
      await expect(service().academicsWorkflow.updateSubject({ subjectId, name: 'Denied' })).rejects.toBeInstanceOf(AuthorizationError)
    await service().academicsWorkflow.configureSubjectMatter({ id: 'empty-chapter', subjectId: input.id, name: 'Numbers', sequenceOrder: 1 })
    expect((await service().baseService.entities.subjectMatters.list()).map(row => row.id)).toEqual(['empty-chapter'])
    await service().academicsWorkflow.removeSubject({ subjectId: input.id })
    expect(await fixture.repositories.subjects.findById(input.id)).toBeUndefined()
  }, 60_000)

  test('shared grade curriculum reads preserve linked class scope and foreign isolation', async () => {
    await curriculum()
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'class_group', classGroupId: 'class-a' }])
    for (const actor of [staff, teacher, guardian, student]) {
      const entities = service(actor).baseService.entities.subjectMatters
      expect((await entities.list()).map(row => row.id)).toEqual(['matter', 'other-matter'])
      expect(await entities.count()).toBe(2)
      expect(await entities.list({ $offset: 2, $limit: 1 })).toEqual([])
      expect(await entities.findById('foreign-matter')).toBeUndefined()
      const own = (await fixture.repositories.subjectMatters.findById('matter'))!
      await expect(entities.save(own)).rejects.toBeInstanceOf(AuthorizationError)
    }
    await fixture.repositories.teacherAssignments.delete('teaching')
    expect(await service(teacher).baseService.entities.subjectMatters.count()).toBe(0)
  })

  test('changing shared curriculum requires update authority for every affected class', async () => {
    await curriculum()
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }])
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'class_group', classGroupId: 'class-other' }])
    const entities = service().baseService.entities.subjectMatters
    const own = (await fixture.repositories.subjectMatters.findById('matter'))!
    const changed = new SubjectMatter(withShortName({ ...own.data, name: 'Changed' }))
    await expect(entities.save(changed)).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.subjectMatters.findById('matter'))?.name).toBe('matter')
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }, { kind: 'class_group', classGroupId: 'class-other' }])
    await entities.save(changed)
    expect((await fixture.repositories.subjectMatters.findById('matter'))?.name).toBe('Changed')
    await expire(Permission.ACADEMIC_PROGRAM_MANAGE)
    await expect(entities.save(own)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test.each(['subjects', 'subjectMatters'] as const)('%s shared details cannot be changed through authority for only one consumer class', async (resource) => {
    await curriculum()
    const entities = service().baseService.entities
    const subject = (await fixture.repositories.subjects.findById('math'))!
    const matter = (await fixture.repositories.subjectMatters.findById('matter'))!
    const change = {
      subjects: () => entities.subjects.save(new Subject(withShortName({ ...subject.data, name: 'Changed' }))),
      subjectMatters: () => entities.subjectMatters.save(new SubjectMatter(withShortName({ ...matter.data, name: 'Changed' }))),
    }[resource]
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'class_group', classGroupId: 'class-a' }])
    await expect(change()).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE, [{ kind: 'all', grain: 'class_group' }])
    await change()
    expect(resource === 'subjects'
      ? (await fixture.repositories.subjects.findById('math'))?.name
      : (await fixture.repositories.subjectMatters.findById('matter'))?.name).toBe('Changed')
  })

  test('grade curriculum management covers creation and deletion and rolls back mixed foreign batches', async () => {
    await curriculum()
    const entities = service().baseService.entities.subjectMatters
    const proposal = new SubjectMatter(withShortName({ id: 'new', subjectId: 'math', name: 'New', sequenceOrder: 2 }))
    await grant(Permission.ACADEMIC_PROGRAM_READ, [{ kind: 'all', grain: 'class_group' }])
    await expect(entities.save(proposal)).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.ACADEMIC_PROGRAM_MANAGE)
    await expect(entities.batchSave([proposal, new SubjectMatter(withShortName({ id: 'bad', subjectId: 'foreign-math', name: 'Bad', sequenceOrder: 2 }))])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.subjectMatters.findById('new')).toBeUndefined()
    await entities.save(proposal)
    await expect(entities.batchDelete(['new', 'foreign-matter'])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.subjectMatters.findById('new')).toBeDefined()
    await entities.delete('new')
    expect(await fixture.repositories.subjectMatters.findById('new')).toBeUndefined()
  })

  test('a service account uses explicit health grants and cannot infer authority from the owner login', async () => {
    await health()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const before = (await fixture.repositories.staffMembers.findById('staff-a'))!
    await fixture.repositories.staffMembers.save(new StaffMember({ ...before.data, accountKind: 'service', identifier: undefined, name: 'Health integration', shortName: 'Health', subjectId: undefined, serviceId: 'health-integration' }))
    const entities = service(createServiceStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })).baseService.entities.studentHealthProfiles
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
    await grant(Permission.STUDENT_HEALTH_READ)
    expect(await entities.count()).toBe(2)
    expect(await entities.findById('health-b')).toBeUndefined()
    await expire(Permission.STUDENT_HEALTH_READ)
    await expect(entities.list()).rejects.toBeInstanceOf(AuthorizationError)
  })
})
