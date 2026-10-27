import { AuthorizationError, createTeacherActorMetadata } from '@edaya/authorization'
import { AttendanceStatus, LessonSession, noOpNotificationGateway, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../../adaptor-postgres/tests/support/pooled-database'
import { testFileStorage } from '../../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const actor = createTeacherActorMetadata({ schoolId: 'school-a', teacherId: 'teacher-a', subjectId: 'person-a', requestId: 'teacher-workflows', authenticatedAt: new Date() })
const startsAt = new Date('2026-06-01T09:00:00Z')
const endsAt = new Date('2026-06-01T10:00:00Z')

describe('teacher attendance and logbook writes use current subject and homeroom assignments', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  let lesson: LessonSession
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    service = new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, commandJournal: new PostgresCommandJournal(), notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    lesson = new LessonSession({ id: 'lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', displayLabel: 'Math', startsAt, endsAt })
    await fixture.repositories.lessonSessions.save(lesson)
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  test('subject teacher submits a private complete call; unrelated students and removed assignments are denied', async () => {
    const input = { requestId: 'draft', expectedVersion: 0, anchor: { kind: 'lesson' as const, lessonSessionId: 'lesson' }, entries: [{ studentId: 'student-a', status: 'present' as const }] }
    await service.teacherCorrectionsWorkflow.attendanceCall('save', input)
    expect(await fixture.repositories.attendance.count()).toBe(0)
    await expect(service.schedulingWorkflow.recordAttendance({ id: 'legacy', studentId: 'student-a', lessonSessionId: 'lesson', status: AttendanceStatus.Present })).rejects.toMatchObject({ code: 'ATTENDANCE_CALL_COMMAND_REQUIRED' })
    await expect(service.teacherCorrectionsWorkflow.attendanceCall('save', { ...input, requestId: 'other', expectedVersion: 1, entries: [{ studentId: 'student-other', status: 'present' }] })).rejects.toBeInstanceOf(AuthorizationError)
    await service.teacherCorrectionsWorkflow.attendanceCall('submit', { ...input, requestId: 'finish', expectedVersion: 1 })
    expect(await fixture.repositories.attendance.count()).toBe(1)
    await fixture.repositories.teacherAssignments.delete('teaching')
    await expect(service.getTeacherAttendanceCall({ anchor: input.anchor })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('homeroom assignment cannot submit subject lesson attendance', async () => {
    await fixture.repositories.teacherAssignments.delete('teaching')
    await fixture.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-a', academicYearId: 'year-a', classGroupId: 'class-a', kind: TeacherAssignmentKind.Homeroom }))
    await expect(service.teacherCorrectionsWorkflow.attendanceCall('submit', { requestId: 'denied', expectedVersion: 0, anchor: { kind: 'lesson', lessonSessionId: 'lesson' }, entries: [{ studentId: 'student-a', status: 'present' }] })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.attendance.count()).toBe(0)
  })

  test('subject teacher edits logbook content, while timing, placement and revocation remain protected', async () => {
    const updated = lesson.copyWith({ sessionNote: 'Covered fractions', displayLabel: 'Math recap' })
    await service.baseService.entities.lessonSessions.save(updated)
    expect((await fixture.repositories.lessonSessions.findById('lesson'))?.sessionNote).toBe('Covered fractions')
    await expect(service.baseService.entities.lessonSessions.save(updated.copyWith({ startsAt: new Date('2026-06-01T09:30:00Z'), endsAt: new Date('2026-06-01T10:30:00Z') }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.baseService.entities.lessonSessions.save(updated.copyWith({ classSubjectId: 'french-a' }))).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.teacherAssignments.delete('teaching')
    await expect(service.baseService.entities.lessonSessions.save(updated.copyWith({ sessionNote: 'Revoked edit' }))).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.lessonSessions.findById('lesson'))?.sessionNote).toBe('Covered fractions')
  })
})
