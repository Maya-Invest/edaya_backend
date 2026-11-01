import { StudentFinanceSummary } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('StudentFinanceSummary', () => {
  test('stores available, outstanding, and overdue amounts', () => {
    const summary = new StudentFinanceSummary({
      studentId: 'stu-1',
      academicYearId: 'year-1',
      currency: 'XOF',
      available: { amount: 20_000, currency: 'XOF' },
      outstanding: { amount: 60_000, currency: 'XOF' },
      overdue: { amount: 40_000, currency: 'XOF' },
    })
    expect(summary.available.amount).toBe(20_000)
    expect(summary.outstanding.amount).toBe(60_000)
    expect(summary.overdue.amount).toBe(40_000)
    expect(summary.accountId).toBeUndefined()
  })
})
