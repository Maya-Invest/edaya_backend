import { AuthorizationError, createGuardianActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Attendance, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, BusinessRuleViolationError, LessonSession, noOpNotificationGateway } from '@edaya/core'
import { expect, setSystemTime, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()
test('history preserves historical participation, daily records and authorized school days without changing Home', async () => {
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET time_zone=\'America/Toronto\' WHERE id=\'school-a\'')
    const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'history', authenticatedAt: new Date() }
    const base = { repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage }
    const guardian = new SchoolService({ commandJournal: new PostgresCommandJournal(), ...base, actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }) })
    const teacher = new SchoolService({ commandJournal: new PostgresCommandJournal(), ...base, actor: createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }) })
    for (const [id, hour, note] of [['missing', '01', ''], ['saved', '02', 'Covered fractions']] as const) {
      await fixture.repositories.lessonSessions.save(new LessonSession({ id, schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', timetableTeacherIds: ['teacher-a'], displayLabel: id, startsAt: new Date(`2026-05-03T${hour}:00:00Z`), endsAt: new Date(`2026-05-03T${hour}:30:00Z`), sessionNote: note || undefined }))
    }
    await fixture.repositories.attendance.save(new AttendanceRecord({ id: 'saved-attendance', studentId: 'student-a', lessonSessionId: 'saved', date: new Date('2026-05-03T02:00:00Z'), status: AttendanceStatus.Late, reason: 'Bus', justificationStatus: AttendanceJustificationStatus.Pending }))
    await fixture.repositories.attendances.save(new Attendance({ id: 'daily-call', schoolId: 'school-a', classGroupId: 'class-a', startsAt: new Date('2026-05-02T12:00:00Z'), endsAt: new Date('2026-05-02T13:00:00Z'), displayLabel: 'Daily' }))
    await fixture.repositories.attendance.save(new AttendanceRecord({ id: 'daily-record', studentId: 'student-a', attendanceId: 'daily-call', date: new Date('2026-05-02'), status: AttendanceStatus.Present }))
    await fixture.db.exec('UPDATE student_class_enrollments SET status=\'closed\', ended_at=\'2026-06-01\', end_reason=\'withdrawn\', closed_by=\'staff-a\' WHERE id=\'enrollment-a\'; UPDATE student_subject_enrollments SET ended_at=\'2026-06-01\' WHERE student_class_enrollment_id=\'enrollment-a\'')
    const range = { academicYearId: 'year-a', startDate: new Date('2026-05-02'), endDate: new Date('2026-05-02') }
    expect((await guardian.getStudentTimetable({ ...range, studentId: 'student-a' })).events.map(e => e.id)).toEqual(['saved'])
    const history = await guardian.getStudentSessionHistory({ ...range, studentId: 'student-a' })
    expect(history.entries.map(e => e.id)).toEqual(['saved', 'missing', 'daily-record'])
    expect(history.entries[0]?.attendance).toMatchObject({ status: 'late', reason: 'Bus', justificationStatus: AttendanceJustificationStatus.Pending })
    expect(history.entries[1]?.attendance).toBeNull()
    expect(history.entries[2]?.kind).toBe('daily')
    expect(history.timeZone).toBe('America/Toronto')
    expect(history.hasMore).toBe(true)
    const teaching = await teacher.getTeacherSessionHistory({ ...range, teacherId: 'teacher-a', classSubjectId: 'math-a' })
    expect(teaching.entries.map(e => e.id)).toEqual(['saved', 'missing'])
    expect(teaching.entries[0]).toMatchObject({ attendanceComplete: true, logbookComplete: true })
    expect(teaching.entries[1]).toMatchObject({ attendanceComplete: false, logbookComplete: false })
    expect((await guardian.getStudentSessionHistory({ ...range, studentId: 'student-a', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-02') })).hasMore).toBe(false)
    await expect(guardian.getStudentSessionHistory({ ...range, studentId: 'student-other' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(guardian.getStudentSessionHistory({ ...range, studentId: 'student-a', academicYearId: 'year-b' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(guardian.getTeacherSessionHistory({ ...range, teacherId: 'teacher-a' })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await guardian.getStudentSessionHistory({ ...range, studentId: 'student-a', endDate: new Date('2026-06-01') })).entries).toHaveLength(3)
    await expect(guardian.getStudentSessionHistory({ ...range, studentId: 'student-a', endDate: new Date('2026-06-02') })).rejects.toBeInstanceOf(BusinessRuleViolationError)
    await fixture.db.exec('DELETE FROM guardian_student_links WHERE id=\'guardian-link\'')
    await expect(guardian.getStudentSessionHistory({ ...range, studentId: 'student-a' })).rejects.toBeInstanceOf(AuthorizationError)
  }
  finally { await releaseDatabase(fixture.db) }
}, 30000)

test('Tokyo history matches attendance by occurrence when its stored date is the preceding UTC day', async () => {
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET time_zone=\'Asia/Tokyo\' WHERE id=\'school-a\'')
    const startsAt = new Date('2026-05-01T17:00:00Z') // May 2 at 02:00 in Tokyo
    await fixture.repositories.lessonSessions.save(new LessonSession({
      id: 'early',
      displayLabel: 'Early lesson',
      schoolId: 'school-a',
      classGroupId: 'class-a',
      classSubjectId: 'math-a',
      startsAt,
      endsAt: new Date('2026-05-01T17:30:00Z'),
    }))
    await fixture.repositories.attendance.save(new AttendanceRecord({
      id: 'early-late',
      studentId: 'student-a',
      lessonSessionId: 'early',
      date: startsAt,
      status: AttendanceStatus.Late,
    }))
    const guardian = new SchoolService({
      commandJournal: new PostgresCommandJournal(),
      repositories: fixture.repositories,
      atomicExecution: fixture.atomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
      actor: createGuardianActorMetadata({ schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', guardianId: 'guardian-a', requestId: 'tokyo-history', authenticatedAt: new Date() }),
    })
    const day = new Date('2026-05-02')
    const history = await guardian.getStudentSessionHistory({ academicYearId: 'year-a', studentId: 'student-a', startDate: day, endDate: day })
    expect(history.entries.find(row => row.id === 'early')?.attendance?.status).toBe(AttendanceStatus.Late)
  }
  finally { await releaseDatabase(fixture.db) }
})

test('sessions ending now enter History while future sessions stay out', async () => {
  setSystemTime(new Date('2026-05-02T12:00:00Z'))
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    const service = new SchoolService({ commandJournal: new PostgresCommandJournal(), repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage, actor: createGuardianActorMetadata({ schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', guardianId: 'guardian-a', requestId: 'today-history', authenticatedAt: new Date() }) })
    for (const [id, start, end] of [['ended', '11', '12'], ['future', '13', '14']] as const) {
      await fixture.repositories.lessonSessions.save(new LessonSession({ id, schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', displayLabel: id, startsAt: new Date(`2026-05-02T${start}:00:00Z`), endsAt: new Date(`2026-05-02T${end}:00:00Z`) }))
    }
    const history = await service.getStudentSessionHistory({ academicYearId: 'year-a', studentId: 'student-a', startDate: new Date('2026-05-02'), endDate: new Date('2026-05-03') })
    expect(history.entries.map(e => e.id)).toEqual(['ended'])
    expect(history.endDate).toBe('2026-05-02')
    expect(history.entries[0]?.attendance).toBeNull()
  }
  finally {
    setSystemTime()
    await releaseDatabase(fixture.db)
  }
}, 30000)
