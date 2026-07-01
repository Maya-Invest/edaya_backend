import { describe, expect, test } from 'bun:test'
import { DomainValidationError } from '../../../src/domain/shared/utils'
import { DateTimeRange } from '../../../src/domain/value-objects/date-time-range'

describe('dateTimeRange value object', () => {
  const startsAt = new Date('2026-09-01T08:00:00.000Z')
  const endsAt = new Date('2026-09-01T09:30:00.000Z')

  test('computes durationMinutes', () => {
    const range = new DateTimeRange({ startsAt, endsAt })
    expect(range.durationMinutes).toBe(90)
  })

  test('contains instants within the window', () => {
    const range = new DateTimeRange({ startsAt, endsAt })
    expect(range.contains(new Date('2026-09-01T08:30:00.000Z'))).toBe(true)
    expect(range.contains(startsAt)).toBe(true)
    expect(range.contains(endsAt)).toBe(true)
    expect(range.contains(new Date('2026-09-01T07:59:00.000Z'))).toBe(false)
  })

  test('throws when endsAt is not after startsAt', () => {
    expect(() => new DateTimeRange({ startsAt: endsAt, endsAt: startsAt })).toThrow(DomainValidationError)
    expect(() => new DateTimeRange({ startsAt, endsAt: startsAt })).toThrow('endsAt must be after startsAt')
  })
})
