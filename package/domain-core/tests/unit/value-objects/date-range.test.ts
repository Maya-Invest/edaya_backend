import { DateRange, DomainValidationError } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('dateRange value object', () => {
  const startDate = new Date('2026-09-01T00:00:00.000Z')
  const endDate = new Date('2026-09-05T00:00:00.000Z')

  test('contains a date within the inclusive range', () => {
    const range = new DateRange({ startDate, endDate })
    expect(range.contains(new Date('2026-09-03T12:00:00.000Z'))).toBe(true)
    expect(range.contains(startDate)).toBe(true)
    expect(range.contains(endDate)).toBe(true)
    expect(range.contains(new Date('2026-08-31T00:00:00.000Z'))).toBe(false)
  })

  test('detects overlapping ranges', () => {
    const left = new DateRange({ startDate, endDate })
    const right = new DateRange({
      startDate: new Date('2026-09-04T00:00:00.000Z'),
      endDate: new Date('2026-09-10T00:00:00.000Z'),
    })
    const separate = new DateRange({
      startDate: new Date('2026-09-06T00:00:00.000Z'),
      endDate: new Date('2026-09-10T00:00:00.000Z'),
    })
    expect(left.overlaps(right)).toBe(true)
    expect(left.overlaps(separate)).toBe(false)
  })

  test('computes inclusive durationDays', () => {
    const range = new DateRange({ startDate, endDate })
    expect(range.durationDays).toBe(5)
  })

  test('throws when endDate is before startDate', () => {
    expect(() => new DateRange({ startDate: endDate, endDate: startDate })).toThrow(DomainValidationError)
  })
})
