import { AuthorizationError, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AttendanceRecord, AttendanceStatus, LessonSession, noOpNotificationGateway, Permission, StaffPermissionAssignment } from '@edaya/core'
import { expect, test } from 'bun:test'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

test('student participation queries retain assigned-subject teacher scope and family historical access', async () => {
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'participation-reads', authenticatedAt: new Date() }
    const base = { repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage }
    const teacher = new SchoolService({ ...base, actor: createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' }) })
    const guardian = new SchoolService({ ...base, actor: createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' }) })
    for (const subject of ['math', 'french']) {
      await fixture.repositories.lessonSessions.save(new LessonSession({ id: `${subject}-lesson`, schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: `${subject}-a`, displayLabel: subject, startsAt: new Date('2026-05-02T09:00:00Z'), endsAt: new Date('2026-05-02T10:00:00Z') }))
    }
    await fixture.db.exec('UPDATE assessments SET lesson_session_id=\'math-lesson\' WHERE id=\'assessment-math\'')
    for (const subject of ['french'])
      await fixture.repositories.attendance.save(new AttendanceRecord({ id: `${subject}-attendance`, studentId: 'student-a', lessonSessionId: `${subject}-lesson`, date: new Date('2026-05-02T09:00:00Z'), status: AttendanceStatus.Present }))
    const history = await teacher.getStudentSubjectEnrollments({ studentId: 'student-a' })
    expect(history.offerings.map(row => row.id)).toEqual(['math-a'])
    expect(history.enrollments.every(row => row.classSubjectId === 'math-a')).toBe(true)
    const range = { studentId: 'student-a', startDate: new Date('2026-05-02'), endDate: new Date('2026-05-02') }
    expect((await teacher.getStudentTimetable(range)).events.map(row => row.id)).toEqual(['math-lesson'])
    await expect(teacher.getClassSubjectRoster({ classSubjectId: 'french-a', at: range.startDate })).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.db.exec('UPDATE student_class_enrollments SET status=\'closed\', ended_at=\'2026-06-01\', end_reason=\'withdrawn\', closed_by=\'staff-a\' WHERE id=\'enrollment-a\'; UPDATE student_subject_enrollments SET ended_at=\'2026-06-01\' WHERE student_class_enrollment_id=\'enrollment-a\'')
    await fixture.db.exec('UPDATE student_subject_enrollments SET deleted_at=\'2026-06-01\', deleted_by=\'staff-a\' WHERE student_class_enrollment_id=\'enrollment-a\'')
    expect((await teacher.getStudentSubjectEnrollments({ studentId: 'student-a' })).enrollments).toHaveLength(0)
    expect((await teacher.getStudentTimetable(range)).events.map(row => row.id)).toEqual(['math-lesson'])
    expect((await guardian.getStudentTimetable(range)).events.map(row => row.id).sort()).toEqual(['french-lesson', 'math-lesson'])
    expect((await guardian.getStudentSubjectEnrollments({ studentId: 'student-a' })).enrollments).toHaveLength(0)
    await expect(guardian.getStudentTimetable({ ...range, studentId: 'student-b' })).rejects.toBeInstanceOf(AuthorizationError)
  }
  finally { await releaseDatabase(fixture.db) }
}, 30000)

test('enrollment read grants authorize participation reads without unrelated student or curriculum grants', async () => {
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'enrollment-reader', schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission: Permission.ENROLLMENT_READ, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const service = new SchoolService({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage, actor: createStaffActorMetadata({ schoolId: 'school-a', subjectId: 'person-a', staffMemberId: 'staff-a', academicYearId: 'year-a', requestId: 'enrollment-read-only', authenticatedAt: new Date() }) })
    expect((await service.getStudentSubjectEnrollments({ studentId: 'student-a' })).enrollments).toHaveLength(2)
    expect((await service.getClassSubjectRoster({ classSubjectId: 'math-a', at: new Date('2026-05-01') })).basis).toBe('unavailable')
    await expect(service.getStudentSubjectEnrollments({ studentId: 'student-other' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.getClassSubjectRoster({ classSubjectId: 'math-other', at: new Date('2026-05-01') })).rejects.toBeInstanceOf(AuthorizationError)
  }
  finally { await releaseDatabase(fixture.db) }
}, 30000)
