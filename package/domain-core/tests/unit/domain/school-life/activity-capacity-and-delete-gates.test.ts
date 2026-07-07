import type { BusinessRuleViolationError } from '../../../../src/domain/shared/business-rule-error'
import { describe, expect, mock, test } from 'bun:test'
import {
  Activity,
  ActivityCategory,
  validateActivityDelete,
} from '../../../../src/domain'
import { DomainValidationError } from '../../../../src/domain/shared/utils'

const baseArgs = {
  id: 'activity-1',
  schoolId: 'school-1',
  name: 'Chess club',
  category: ActivityCategory.Arts,
  coach: 'Coach Sam',
  schedule: 'Wednesdays 3–5pm',
  participants: 8,
  capacity: 20,
  description: 'Weekly chess practice',
  startDate: new Date('2025-09-01T00:00:00.000Z'),
  endDate: new Date('2026-06-30T00:00:00.000Z'),
}

describe('Activity domain invariants', () => {
  test('accepts valid activity definitions', () => {
    const activity = new Activity(baseArgs)

    expect(activity.name).toBe('Chess club')
    expect(activity.participants).toBe(8)
    expect(activity.capacity).toBe(20)
  })

  test('rejects inverted date ranges and participant counts above capacity', () => {
    expect(() => new Activity({
      ...baseArgs,
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
    })).toThrow(DomainValidationError)

    expect(() => new Activity({
      ...baseArgs,
      participants: 25,
      capacity: 20,
    })).toThrow(DomainValidationError)
  })
})

describe('validateActivityDelete', () => {
  test('allows delete when no enrollments exist', async () => {
    await validateActivityDelete(new Activity(baseArgs), {
      activityEnrollments: { list: mock(async () => []) },
      classActivityEnrollments: { list: mock(async () => []) },
    } as never)
  })

  test('blocks delete while student or class enrollments remain', async () => {
    const activity = new Activity(baseArgs)

    await expect(validateActivityDelete(activity, {
      activityEnrollments: { list: mock(async () => [{ id: 'enr-1' }]) },
      classActivityEnrollments: { list: mock(async () => []) },
    } as never)).rejects.toMatchObject({
      code: 'ACTIVITY_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)

    await expect(validateActivityDelete(activity, {
      activityEnrollments: { list: mock(async () => []) },
      classActivityEnrollments: { list: mock(async () => [{ id: 'cae-1' }]) },
    } as never)).rejects.toMatchObject({
      code: 'ACTIVITY_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
