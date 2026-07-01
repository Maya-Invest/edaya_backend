import type { SchoolRepositories } from '../../src/ports'
import { describe, expect, test } from 'bun:test'
import { buildClassGroupTimetable } from '../../src/application/queries/timetable'
import { ActivitySession, Assessment, AssessmentKind, LessonSession, OccurrenceStatus } from '../../src/domain'

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
})
