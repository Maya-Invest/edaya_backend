import { AuthorizationError, createTeacherActorMetadata } from '@edaya/authorization'
import { ClassGroup, ClassSubject, LessonSession, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'

const startsAt = new Date('2026-06-01T09:00:00.000Z')
const endsAt = new Date('2026-06-01T10:00:00.000Z')

describe('Lesson session teacher logbook save', () => {
  test('allows assigned teachers to update session notes without timetable manage', async () => {
    const teacherActor = createTeacherActorMetadata({
      subjectId: 'teacher-user',
      teacherId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
      teacherScope: {
        teaching: { classSubjectIds: ['cs-1'] },
        homeroom: { classGroupIds: [] },
      },
    })
    const { app, repositories } = createTestApp(teacherActor)

    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    const existing = new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'cs-1',
      displayLabel: 'Math',
      startsAt,
      endsAt,
    })
    await repositories.lessonSessionRepository.save(existing)

    await app.baseService.entities.lessonSessions.save(existing.copyWith({
      sessionNote: 'Covered fractions',
      displayLabel: 'Math recap',
    }))

    const saved = await repositories.lessonSessionRepository.findById('session-1')
    expect(saved?.sessionNote).toBe('Covered fractions')
    expect(saved?.displayLabel).toBe('Math recap')
  })

  test('denies teachers from changing lesson session timing', async () => {
    const teacherActor = createTeacherActorMetadata({
      subjectId: 'teacher-user',
      teacherId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request',
      authenticatedAt: new Date('2026-06-01T00:00:00.000Z'),
      teacherScope: {
        teaching: { classSubjectIds: ['cs-1'] },
        homeroom: { classGroupIds: [] },
      },
    })
    const { app, repositories } = createTestApp(teacherActor)

    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))
    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    await repositories.classSubjectRepository.save(new ClassSubject({
      id: 'cs-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
    }))
    const existing = new LessonSession({
      id: 'session-1',
      schoolId: 'school',
      classGroupId: 'class-1',
      scheduleId: 'schedule-1',
      classSubjectId: 'cs-1',
      displayLabel: 'Math',
      startsAt,
      endsAt,
    })
    await repositories.lessonSessionRepository.save(existing)

    await expect(app.baseService.entities.lessonSessions.save(existing.copyWith({
      startsAt: new Date('2026-06-01T09:30:00.000Z'),
      endsAt: new Date('2026-06-01T10:30:00.000Z'),
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
