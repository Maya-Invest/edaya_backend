import type { SchoolRepositories } from '@edaya/school-service'
import { Activity, ActivityCategory, ActivitySession, Assessment, AssessmentKind, LessonSession, OccurrenceStatus, Teacher, TeacherAssignment, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildClassGroupTimetable } from '../../src/services/queries/timetable'

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
    ...overrides,
  })
}

function activitySession(overrides: Partial<ConstructorParameters<typeof ActivitySession>[0]> & { id: string }): ActivitySession {
  return new ActivitySession({
    schoolId: 'school-1',
    classGroupId: 'cg-1',
    scheduleId: 'sch-act',
    activityId: 'act-1',
    status: OccurrenceStatus.Pending,
    startsAt: new Date('2026-05-15T15:00:00.000Z'),
    endsAt: new Date('2026-05-15T16:00:00.000Z'),
    displayLabel: 'Chess Club',
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

describe('buildClassGroupTimetable', () => {
  test('returns lesson sessions and in-class assessments sorted by startsAt', async () => {
    const linkedLesson = lessonSession({
      id: 'ls-linked',
      startsAt: new Date('2026-05-13T10:00:00.000Z'),
      endsAt: new Date('2026-05-13T11:00:00.000Z'),
      displayLabel: 'French',
    })
    const repos = {
      lessonSessions: {
        list: async () => [
          lessonSession({ id: 'ls-1' }),
          linkedLesson,
        ],
      },
      activitySessions: { list: async () => [] },
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
            id: 'a-homework',
            title: 'Homework',
            kind: AssessmentKind.Homework,
            dueAt: new Date('2026-05-15T00:00:00.000Z'),
          }),
        ],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-12T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
    })

    expect(timetable.events.map(event => event.id)).toEqual([
      'ls-1',
      'ls-linked',
      'a-linked',
      'a-date',
    ])
    expect(timetable.events[0]?.kind).toBe('lesson')
    expect(timetable.events.find(event => event.id === 'a-linked')?.startsAt).toEqual(linkedLesson.startsAt)
    expect(timetable.events.find(event => event.id === 'a-date')?.startsAt.toISOString()).toBe('2026-05-14T09:00:00.000Z')
  })

  test('includes activity sessions in the timetable', async () => {
    const repos = {
      lessonSessions: { list: async () => [] },
      activitySessions: {
        list: async () => [activitySession({ id: 'as-1' })],
      },
      assessments: { list: async () => [] },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
    })

    expect(timetable.events).toHaveLength(1)
    expect(timetable.events[0]?.kind).toBe('activity')
    expect(timetable.events[0]?.activityId).toBe('act-1')
  })

  test('excludes assessments outside the requested range', async () => {
    const repos = {
      lessonSessions: { list: async () => [] },
      activitySessions: { list: async () => [] },
      assessments: {
        list: async () => [
          assessment({
            id: 'a-out',
            startsAt: new Date('2026-06-01T09:00:00.000Z'),
            endsAt: new Date('2026-06-01T10:00:00.000Z'),
          }),
        ],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
    })

    expect(timetable.events).toHaveLength(0)
  })

  test('ignores linked assessments when the lesson session is outside the range', async () => {
    const repos = {
      lessonSessions: {
        list: async () => [],
      },
      activitySessions: { list: async () => [] },
      assessments: {
        list: async () => [assessment({
          id: 'a-linked-out',
          lessonSessionId: 'ls-out',
        })],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-12T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
    })

    expect(timetable.events).toHaveLength(0)
  })

  test('ignores linked assessments when the lesson session id is unknown', async () => {
    const repos = {
      lessonSessions: { list: async () => [] },
      activitySessions: { list: async () => [] },
      assessments: {
        list: async () => [assessment({
          id: 'a-missing-lesson',
          lessonSessionId: 'missing-lesson',
        })],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-12T00:00:00.000Z'),
      endDate: new Date('2026-05-14T23:59:59.999Z'),
    })

    expect(timetable.events).toHaveLength(0)
  })

  test('enriches subject teacher names and activity coach from repository joins', async () => {
    const repos = {
      classGroups: {
        findById: async () => ({
          id: 'cg-1',
          academicYearId: 'ay-2025',
        }),
      },
      lessonSessions: {
        list: async () => [lessonSession({ id: 'ls-1', classSubjectId: 'cs-math' })],
      },
      activitySessions: {
        list: async () => [activitySession({ id: 'as-1', activityId: 'act-chess' })],
      },
      assessments: { list: async () => [] },
      teacherAssignments: {
        list: async () => [new TeacherAssignment({
          id: 'ta-1',
          teacherId: 'teacher-1',
          academicYearId: 'ay-2025',
          kind: TeacherAssignmentKind.Subject,
          classSubjectId: 'cs-math',
          status: TeacherAssignmentStatus.Active,
        })],
      },
      teachers: {
        findByIds: async () => [new Teacher({
          id: 'teacher-1',
          schoolId: 'school-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
        })],
      },
      activities: {
        findByIds: async () => [new Activity({
          id: 'act-chess',
          schoolId: 'school-1',
          name: 'Chess Club',
          category: ActivityCategory.Wellbeing,
          coach: 'Coach Martin',
          schedule: 'Wednesdays',
          participants: 12,
          capacity: 20,
          description: 'Chess',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        })],
      },
    } as unknown as SchoolRepositories

    const timetable = await buildClassGroupTimetable(repos, {
      classGroupId: 'cg-1',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
    })

    const lesson = timetable.events.find(event => event.kind === 'lesson')
    const activity = timetable.events.find(event => event.kind === 'activity')

    expect(lesson?.subjectLabel).toBe('Math')
    expect(lesson?.teacherName).toBe('Ada Lovelace')
    expect(activity?.subjectLabel).toBe('Chess Club')
    expect(activity?.teacherName).toBe('Coach Martin')
  })
})
