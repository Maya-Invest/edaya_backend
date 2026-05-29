import { describe, expect, test } from 'bun:test'
import { AttendanceSummary } from '../../../src/value_object/attendance-summary'

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

  test('should throw error for negative values', () => {
    const summary = new AttendanceSummary({
      presentCount: 0,
      absenceCount: 0,
      lateCount: 0,
    })

    expect(summary.total).toBe(0)
    expect(summary.attendanceRate).toBe(0)
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
