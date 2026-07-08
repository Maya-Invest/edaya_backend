import type { BusinessRuleViolationError } from '../../../../src/domain/shared/business-rule-error'
import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError } from '../../../../src/capabilities/authorization'
import {
  isLessonSessionLogbookOnlyUpdate,
  LessonSession,
  OccurrenceStatus,
  validateLessonSessionSave,
} from '../../../../src/domain'
import { DomainValidationError } from '../../../../src/domain/shared/utils'

const startsAt = new Date('2026-06-01T09:00:00.000Z')
const endsAt = new Date('2026-06-01T10:00:00.000Z')

function lessonSession(overrides: Record<string, unknown> = {}) {
  return new LessonSession({
    id: 'session-1',
    schoolId: 'school-1',
    classGroupId: 'class-1',
    scheduleId: 'schedule-1',
    classSubjectId: 'cs-1',
    displayLabel: 'Math',
    startsAt,
    endsAt,
    ...overrides,
  })
}

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    classSubjects: {
      findById: mock(async () => ({ id: 'cs-1', classGroupId: 'class-1' })),
    },
    ...overrides,
  } as never
}

describe('LessonSession domain invariants', () => {
  test('computes durationMinutes from the occurrence window', () => {
    expect(lessonSession().durationMinutes).toBe(60)
  })

  test('marks pending non-exception sessions as resync eligible', () => {
    expect(lessonSession().isResyncEligible).toBe(true)
    expect(lessonSession({ status: OccurrenceStatus.Completed }).isResyncEligible).toBe(false)
    expect(lessonSession({ isException: true }).isResyncEligible).toBe(false)
  })

  test('rejects lesson sessions where endsAt is not after startsAt', () => {
    expect(() => lessonSession({
      startsAt: new Date('2026-06-01T11:00:00.000Z'),
      endsAt: new Date('2026-06-01T10:00:00.000Z'),
    })).toThrow(DomainValidationError)
  })

  test('copies with updated session notes without changing identity fields', () => {
    const updated = lessonSession({ sessionNote: 'Review day' }).copyWith({
      sessionNote: 'Exam prep',
      displayLabel: 'Math review',
    })

    expect(updated.id).toBe('session-1')
    expect(updated.sessionNote).toBe('Exam prep')
    expect(updated.displayLabel).toBe('Math review')
  })

  test('detects logbook-only updates when structural fields are unchanged', () => {
    const existing = lessonSession({ sessionNote: 'Day 1' })
    const updated = existing.copyWith({
      sessionNote: 'Day 2',
      displayLabel: 'Math recap',
    })

    expect(isLessonSessionLogbookOnlyUpdate(updated, existing)).toBe(true)
    expect(isLessonSessionLogbookOnlyUpdate(updated.copyWith({
      status: OccurrenceStatus.Completed,
    }), existing)).toBe(false)
  })
})

describe('validateLessonSessionSave', () => {
  test('accepts new lesson sessions when the class subject belongs to the class group', async () => {
    await validateLessonSessionSave(lessonSession(), undefined, repositories())
  })

  test('rejects lesson sessions when the class subject belongs to another class group', async () => {
    await expect(validateLessonSessionSave(lessonSession(), undefined, repositories({
      classSubjects: {
        findById: mock(async () => ({ id: 'cs-1', classGroupId: 'class-2' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects changes to completed session status or timing', async () => {
    const existing = lessonSession({ status: OccurrenceStatus.Completed })

    await expect(validateLessonSessionSave(existing.copyWith({
      status: OccurrenceStatus.Pending,
    }), existing, repositories())).rejects.toMatchObject({
      code: 'OCCURRENCE_IMMUTABLE',
    } satisfies Partial<BusinessRuleViolationError>)

    await expect(validateLessonSessionSave(existing.copyWith({
      startsAt: new Date('2026-06-01T09:30:00.000Z'),
    }), existing, repositories())).rejects.toMatchObject({
      code: 'OCCURRENCE_IMMUTABLE',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('allows non-timing updates to completed sessions when status and window are unchanged', async () => {
    const existing = lessonSession({ status: OccurrenceStatus.Completed })

    await validateLessonSessionSave(existing.copyWith({
      displayLabel: 'Math recap',
      sessionNote: 'Finished early',
    }), existing, repositories())
  })
})
