import { AuthorizationError, createTeacherActorMetadata } from '@edaya/authorization'
import { AttendanceStatus, LessonSession, noOpNotificationGateway, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { testFileStorage } from '../../support/test-file-storage'

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
    service = new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    lesson = new LessonSession({ id: 'lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', displayLabel: 'Math', startsAt, endsAt })
    await fixture.repositories.lessonSessions.save(lesson)
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  test('subject teacher records lesson attendance, but unrelated students and removed assignments are denied', async () => {
    const input = { id: 'attendance', studentId: 'student-a', lessonSessionId: 'lesson', status: AttendanceStatus.Present }
    expect((await service.schedulingWorkflow.recordAttendance(input)).lessonSessionId).toBe('lesson')
    await expect(service.schedulingWorkflow.recordAttendance({ ...input, id: 'other', studentId: 'student-other' })).rejects.toThrow()
    await fixture.repositories.teacherAssignments.delete('teaching')
    await expect(service.schedulingWorkflow.recordAttendance({ ...input, id: 'revoked' })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.attendance.count()).toBe(1)
  })

  test('homeroom assignment cannot record subject lesson attendance', async () => {
    await fixture.repositories.teacherAssignments.delete('teaching')
    await fixture.repositories.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-a', academicYearId: 'year-a', classGroupId: 'class-a', kind: TeacherAssignmentKind.Homeroom }))
    await expect(service.schedulingWorkflow.recordAttendance({ id: 'attendance', studentId: 'student-a', lessonSessionId: 'lesson', status: AttendanceStatus.Present })).rejects.toBeInstanceOf(AuthorizationError)
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
