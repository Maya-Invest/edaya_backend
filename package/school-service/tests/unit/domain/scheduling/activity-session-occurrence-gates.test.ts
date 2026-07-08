import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { ActivitySession, DomainValidationError, OccurrenceStatus } from '@edaya/core'
import { validateActivitySessionSave } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'

const startsAt = new Date('2026-06-01T15:00:00.000Z')
const endsAt = new Date('2026-06-01T16:30:00.000Z')

function activitySession(overrides: Record<string, unknown> = {}) {
  return new ActivitySession({
    id: 'activity-session-1',
    schoolId: 'school-1',
    classGroupId: 'class-1',
    scheduleId: 'schedule-1',
    activityId: 'activity-1',
    displayLabel: 'Chess club',
    startsAt,
    endsAt,
    ...overrides,
  })
}

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    activities: {
      findById: mock(async () => ({ id: 'activity-1', schoolId: 'school-1' })),
    },
    ...overrides,
  } as never
}

describe('ActivitySession domain invariants', () => {
  test('computes durationMinutes from the occurrence window', () => {
    expect(activitySession().durationMinutes).toBe(90)
  })

  test('marks pending non-exception sessions as resync eligible', () => {
    expect(activitySession().isResyncEligible).toBe(true)
    expect(activitySession({ status: OccurrenceStatus.Cancelled }).isResyncEligible).toBe(false)
    expect(activitySession({ isException: true }).isResyncEligible).toBe(false)
  })

  test('rejects activity sessions where endsAt is not after startsAt', () => {
    expect(() => activitySession({
      startsAt: new Date('2026-06-01T17:00:00.000Z'),
      endsAt: new Date('2026-06-01T16:00:00.000Z'),
    })).toThrow(DomainValidationError)
  })
})

describe('validateActivitySessionSave', () => {
  test('accepts new activity sessions when the activity belongs to the same school', async () => {
    await validateActivitySessionSave(activitySession(), undefined, repositories())
  })

  test('rejects activity sessions when the activity is missing or belongs to another school', async () => {
    await expect(validateActivitySessionSave(activitySession(), undefined, repositories({
      activities: { findById: mock(async () => undefined) },
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await expect(validateActivitySessionSave(activitySession(), undefined, repositories({
      activities: {
        findById: mock(async () => ({ id: 'activity-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects changes to cancelled session status or timing', async () => {
    const existing = activitySession({ status: OccurrenceStatus.Cancelled })

    await expect(validateActivitySessionSave(existing.copyWith({
      status: OccurrenceStatus.Pending,
    }), existing, repositories())).rejects.toMatchObject({
      code: 'OCCURRENCE_IMMUTABLE',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('allows note updates to cancelled sessions when status and window are unchanged', async () => {
    const existing = activitySession({ status: OccurrenceStatus.Cancelled })

    await validateActivitySessionSave(existing.copyWith({
      notes: 'Rain cancellation',
      displayLabel: 'Chess club (cancelled)',
    }), existing, repositories())
  })
})
