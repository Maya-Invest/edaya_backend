import { describe, expect, test } from 'bun:test'
import { DomainValidationError } from '../../../src/domain/shared/utils'
import { AttendanceSummary } from '../../../src/domain/value-objects/attendance-summary'

describe('attendanceSummary value object', () => {
  test('should create valid summary', () => {
    const summary = new AttendanceSummary({
      presentCount: 10,
      absenceCount: 2,
      excusedAbsenceCount: 1,
      lateCount: 3,
    })

    expect(summary.presentCount).toBe(10)
    expect(summary.absenceCount).toBe(2)
    expect(summary.excusedAbsenceCount).toBe(1)
    expect(summary.lateCount).toBe(3)
    expect(summary.total).toBe(15) // 10 + 2 + 3
    expect(summary.attendanceRate).toBe(10 / 15)
  })

  test('handles zero counts with zero attendance rate', () => {
    const summary = new AttendanceSummary({
      presentCount: 0,
      absenceCount: 0,
      lateCount: 0,
    })

    expect(summary.total).toBe(0)
    expect(summary.attendanceRate).toBe(0)
  })

  test('throws DomainValidationError for negative counts', () => {
    expect(() => new AttendanceSummary({
      presentCount: -1,
      absenceCount: 0,
      lateCount: 0,
    })).toThrow(DomainValidationError)
  })

  test('throws error if excusedAbsenceCount exceeds absenceCount', () => {
    expect(() => {
      new AttendanceSummary({
        presentCount: 10,
        absenceCount: 2,
        excusedAbsenceCount: 3,
        lateCount: 1,
      })
    }).toThrow('excusedAbsenceCount must not exceed absenceCount')
  })
})
