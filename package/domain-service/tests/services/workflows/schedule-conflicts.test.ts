import { AssessmentKind, BusinessRuleViolationError, DayOfWeek, LessonSession, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus, TeacherUnavailability, TeacherUnavailabilityRecurrence, TimetableGenerated } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { validateLessonSessionSave } from '../../../src/services/entities/config/scheduling/lesson-session'
import { assertNoClassGroupScheduleConflict, assertNoSessionConflict } from '../../../src/services/workflows/schedule-conflicts'

describe('assertNoClassGroupScheduleConflict', () => {
  test('ignores cancelled lesson sessions and excluded ids', async () => {
    await expect(assertNoClassGroupScheduleConflict({
      lessonSessions: {
        list: async () => [{
          id: 'lesson-cancelled',
          classGroupId: 'cg1',
          status: OccurrenceStatus.Cancelled,
          startsAt: new Date('2026-05-28T08:00:00.000Z'),
          endsAt: new Date('2026-05-28T09:00:00.000Z'),
        }],
      },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
    } as never, {
      classGroupId: 'cg1',
      startsAt: new Date('2026-05-28T08:30:00.000Z'),
      endsAt: new Date('2026-05-28T09:30:00.000Z'),
      excludeLessonSessionId: 'lesson-cancelled',
    })).resolves.toBeUndefined()
  })

  test('rejects overlapping in-class assessments', async () => {
    await expect(assertNoClassGroupScheduleConflict({
      lessonSessions: { list: async () => [] },
      activitySessions: { list: async () => [] },
      assessments: {
        list: async () => [{
          id: 'assessment-1',
          classGroupId: 'cg1',
          kind: AssessmentKind.Quiz,
          startsAt: new Date('2026-05-28T09:00:00.000Z'),
          endsAt: new Date('2026-05-28T10:00:00.000Z'),
        }],
      },
    } as never, {
      classGroupId: 'cg1',
      startsAt: new Date('2026-05-28T09:30:00.000Z'),
      endsAt: new Date('2026-05-28T10:30:00.000Z'),
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('allows adjacent occurrences', async () => {
    await expect(assertNoSessionConflict({
      lessonSessions: {
        list: async () => [{
          id: 'lesson-1',
          classGroupId: 'cg1',
          status: OccurrenceStatus.Pending,
          startsAt: new Date('2026-05-28T08:00:00.000Z'),
          endsAt: new Date('2026-05-28T09:00:00.000Z'),
        }],
      },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
    } as never, {
      classGroupId: 'cg1',
      startsAt: new Date('2026-05-28T09:00:00.000Z'),
      endsAt: new Date('2026-05-28T10:00:00.000Z'),
    })).resolves.toBeUndefined()
  })

  test('rejects cross-class overlap for any co-teacher', async () => {
    await expect(assertNoSessionConflict({
      lessonSessions: {
        list: async (filter: Record<string, unknown>) => 'classSubjectId' in filter
          ? [{
              id: 'other-class-lesson',
              classGroupId: 'cg2',
              classSubjectId: 'cs-other',
              status: OccurrenceStatus.Pending,
              startsAt: new Date('2026-05-28T08:00:00.000Z'),
              endsAt: new Date('2026-05-28T09:00:00.000Z'),
            }]
          : [],
      },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
      teacherAssignments: {
        list: async () => [{
          id: 'assignment-1',
          teacherId: 'teacher-2',
          academicYearId: 'year-1',
          kind: TeacherAssignmentKind.Subject,
          classSubjectId: 'cs-other',
          status: TeacherAssignmentStatus.Active,
          createdAt: new Date(),
        }],
      },
      teacherUnavailabilities: { list: async () => [] },
    } as never, {
      classGroupId: 'cg1',
      teacherIds: ['teacher-1', 'teacher-2'],
      startsAt: new Date('2026-05-28T08:30:00.000Z'),
      endsAt: new Date('2026-05-28T09:30:00.000Z'),
    })).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
  })

  test('rejects cross-class overlap using the generated teacher snapshot', async () => {
    const generatedLesson = new LessonSession({
      id: 'generated-fallback-lesson',
      schoolId: 'school-1',
      classGroupId: 'cg2',
      classSubjectId: 'cs-without-assignment',
      status: OccurrenceStatus.Pending,
      startsAt: new Date('2026-05-28T08:00:00.000Z'),
      endsAt: new Date('2026-05-28T09:00:00.000Z'),
      displayLabel: 'Generated lesson',
      timetableGenerated: TimetableGenerated.Draft,
      timetableTeacherIds: ['teacher-1'],
    })

    await expect(assertNoSessionConflict({
      lessonSessions: {
        list: async (filter: Record<string, unknown>) => 'startsAt' in filter ? [generatedLesson] : [],
      },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
      teacherAssignments: { list: async () => [] },
      teacherUnavailabilities: { list: async () => [] },
    } as never, {
      classGroupId: 'cg1',
      teacherIds: ['teacher-1'],
      startsAt: new Date('2026-05-28T08:30:00.000Z'),
      endsAt: new Date('2026-05-28T09:30:00.000Z'),
    })).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
  })

  test('rejects a session that overlaps recurring teacher unavailability', async () => {
    const unavailable = new TeacherUnavailability({
      id: 'contract-hours',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Thursday,
      startTime: '08:30',
      endTime: '10:15',
      effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-06-30T00:00:00.000Z'),
    })
    await expect(assertNoSessionConflict({
      lessonSessions: { list: async () => [] },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
      teacherAssignments: { list: async () => [] },
      teacherUnavailabilities: { list: async () => [unavailable] },
    } as never, {
      classGroupId: 'cg1',
      teacherIds: ['teacher-1'],
      startsAt: new Date('2026-05-28T08:00:00.000Z'),
      endsAt: new Date('2026-05-28T09:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'TEACHER_UNAVAILABLE' })
  })

  test('validates standalone saves and reserves generated state transitions for workflows', async () => {
    const repositories = {
      classSubjects: {
        findById: async () => ({ id: 'cs1', classGroupId: 'cg1' }),
      },
      teacherAssignments: { list: async () => [] },
      lessonSessions: {
        list: async () => [{
          id: 'blocking-lesson',
          classGroupId: 'cg1',
          status: OccurrenceStatus.Pending,
          startsAt: new Date('2026-05-28T08:00:00.000Z'),
          endsAt: new Date('2026-05-28T09:00:00.000Z'),
        }],
      },
      activitySessions: { list: async () => [] },
      assessments: { list: async () => [] },
    } as never
    const standalone = new LessonSession({
      id: 'standalone',
      schoolId: 'school-1',
      classGroupId: 'cg1',
      classSubjectId: 'cs1',
      startsAt: new Date('2026-05-28T08:30:00.000Z'),
      endsAt: new Date('2026-05-28T09:30:00.000Z'),
      displayLabel: 'Standalone lesson',
    })

    await expect(validateLessonSessionSave(standalone, undefined, repositories)).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
    })
    await expect(validateLessonSessionSave(standalone.copyWith({
      timetableGenerated: TimetableGenerated.Draft,
    }), undefined, repositories)).rejects.toMatchObject({
      code: 'TIMETABLE_GENERATED_STATE_WORKFLOW_ONLY',
    })
  })
})
