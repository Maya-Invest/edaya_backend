import { Attendance, DomainValidationError } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('Attendance domain invariants', () => {
  test('computes durationMinutes from the occurrence window', () => {
    const attendance = new Attendance({
      id: 'att-1',
      schoolId: 'school-1',
      classGroupId: 'class-1',
      displayLabel: 'Morning roll call',
      startsAt: new Date('2026-06-01T08:00:00.000Z'),
      endsAt: new Date('2026-06-01T08:30:00.000Z'),
    })

    expect(attendance.durationMinutes).toBe(30)
  })

  test('rejects attendance windows where endsAt is not after startsAt', () => {
    expect(() => new Attendance({
      id: 'att-1',
      schoolId: 'school-1',
      classGroupId: 'class-1',
      displayLabel: 'Morning roll call',
      startsAt: new Date('2026-06-01T09:00:00.000Z'),
      endsAt: new Date('2026-06-01T08:00:00.000Z'),
    })).toThrow(DomainValidationError)
  })
})
