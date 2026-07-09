import { DomainValidationError, TimeRange } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('timeRange value object', () => {
  test('computes durationMinutes', () => {
    const range = new TimeRange({ startTime: '08:00', endTime: '08:45' })
    expect(range.durationMinutes).toBe(45)
  })

  test('throws when endTime is not after startTime', () => {
    expect(() => new TimeRange({ startTime: '09:00', endTime: '08:00' })).toThrow(DomainValidationError)
    expect(() => new TimeRange({ startTime: '09:00', endTime: '09:00' })).toThrow('endTime must be after startTime')
  })

  test('throws for invalid time format', () => {
    expect(() => new TimeRange({ startTime: '25:00', endTime: '10:00' })).toThrow(DomainValidationError)
  })
})
