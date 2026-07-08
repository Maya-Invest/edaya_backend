import { AssessmentKind, BusinessRuleViolationError, OccurrenceStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { assertNoClassGroupScheduleConflict } from '../../../src/services/workflows/schedule-conflicts'

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
})
