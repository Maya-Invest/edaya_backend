import type { SchoolRepositories } from '@edaya/service'
import { ActivitySession, Assessment, AssessmentKind, LessonSession, OccurrenceStatus, TeacherAssignment, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildTeacherTimetable } from '../../src/services/queries/timetable'

function lessonSession(overrides: Partial<ConstructorParameters<typeof LessonSession>[0]> & { id: string }): LessonSession {
  return new LessonSession({
    schoolId: 'school-1',
    classGroupId: 'cg-1',
    scheduleId: 'sch-1',
    classSubjectId: 'cs-1',
    status: OccurrenceStatus.Pending,
    startsAt: new Date('2026-05-12T08:30:00.000Z'),
    endsAt: new Date('2026-05-12T09:30:00.000Z'),
    displayLabel: 'Math',
    timetableTeacherIds: ['teacher-1'],
    ...overrides,
  })
}

function assessment(overrides: Partial<ConstructorParameters<typeof Assessment>[0]> & { id: string }): Assessment {
  return new Assessment({
    classGroupId: 'cg-1',
    classSubjectId: 'cs-1',
    periodId: 'p-1',
    title: 'Quiz',
    kind: AssessmentKind.Quiz,
    maxScore: 20,
    ...overrides,
  })
}

describe('buildTeacherTimetable', () => {
  test('keeps sessions assigned to the teacher, in-class assessments on active subjects, and skips activities', async () => {
    const linkedLesson = lessonSession({
      id: 'ls-linked',
      startsAt: new Date('2026-05-13T10:00:00.000Z'),
      endsAt: new Date('2026-05-13T11:00:00.000Z'),
      displayLabel: 'French',
      classSubjectId: 'cs-1',
    })
    const repos = {
      lessonSessions: {
        list: async () => [
          lessonSession({ id: 'ls-1' }),
          linkedLesson,
          lessonSession({
            id: 'ls-other-teacher',
            timetableTeacherIds: ['teacher-2'],
            displayLabel: 'History',
          }),
        ],
      },
      activitySessions: {
        list: async () => [new ActivitySession({
          id: 'as-1',
          schoolId: 'school-1',
          classGroupId: 'cg-1',
          scheduleId: 'sch-act',
          activityId: 'act-1',
          status: OccurrenceStatus.Pending,
          startsAt: new Date('2026-05-12T15:00:00.000Z'),
          endsAt: new Date('2026-05-12T16:00:00.000Z'),
          displayLabel: 'Chess Club',
        })],
      },
      assessments: {
        list: async () => [
          assessment({
            id: 'a-date',
            title: 'History test',
            startsAt: new Date('2026-05-14T09:00:00.000Z'),
            endsAt: new Date('2026-05-14T10:00:00.000Z'),
          }),
          assessment({
            id: 'a-linked',
            title: 'French quiz',
            lessonSessionId: 'ls-linked',
          }),
          assessment({
            id: 'a-other-subject',
            classSubjectId: 'cs-other',
            title: 'Other quiz',
            startsAt: new Date('2026-05-14T11:00:00.000Z'),
            endsAt: new Date('2026-05-14T12:00:00.000Z'),
          }),
          assessment({
            id: 'a-homework',
            title: 'Homework',
            kind: AssessmentKind.Homework,
            dueAt: new Date('2026-05-15T00:00:00.000Z'),
          }),
        ],
      },
      teacherAssignments: {
        list: async () => [new TeacherAssignment({
          id: 'ta-1',
          teacherId: 'teacher-1',
          academicYearId: 'ay-2025',
          kind: TeacherAssignmentKind.Subject,
          classSubjectId: 'cs-1',
          status: TeacherAssignmentStatus.Active,
        })],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildTeacherTimetable(repos, {
      teacherId: 'teacher-1',
      startDate: new Date('2026-05-12T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
    })

    expect(timetable.teacherId).toBe('teacher-1')
    expect(timetable.events.map(event => event.id)).toEqual([
      'ls-1',
      'ls-linked',
      'a-linked',
      'a-date',
    ])
    expect(timetable.events.every(event => event.kind !== 'activity')).toBe(true)
  })

  test('omits assessments when the teacher has no active subject assignment', async () => {
    const repos = {
      lessonSessions: { list: async () => [lessonSession({ id: 'ls-1' })] },
      activitySessions: { list: async () => [] },
      assessments: {
        list: async () => {
          throw new Error('assessments should not be listed without active subjects')
        },
      },
      teacherAssignments: { list: async () => [] },
    } as unknown as SchoolRepositories

    const timetable = await buildTeacherTimetable(repos, {
      teacherId: 'teacher-1',
      startDate: new Date('2026-05-12T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
    })

    expect(timetable.events.map(event => event.id)).toEqual(['ls-1'])
  })
})
