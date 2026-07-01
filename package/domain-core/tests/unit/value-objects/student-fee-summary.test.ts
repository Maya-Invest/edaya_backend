import { describe, expect, test } from 'bun:test'
import { DomainValidationError } from '../../../src/domain/shared/utils'
import { StudentFeeSummary } from '../../../src/domain/value-objects/student-fee-summary'

describe('studentFeeSummary value object', () => {
  test('computes balanceDue from totals', () => {
    const summary = new StudentFeeSummary({
      totalExpected: { amount: 150000, currency: 'XAF' },
      totalPaid: { amount: 40000, currency: 'XAF' },
      totalOverdue: { amount: 50000, currency: 'XAF' },
      totalAdjusted: { amount: 10000, currency: 'XAF' },
      itemCount: 2,
    })
    expect(summary.balanceDue.amount).toBe(100000)
    expect(summary.itemCount).toBe(2)
  })

  test('defaults totalAdjusted to zero in balanceDue', () => {
    const summary = new StudentFeeSummary({
      totalExpected: { amount: 100000, currency: 'XAF' },
      totalPaid: { amount: 25000, currency: 'XAF' },
      totalOverdue: { amount: 0, currency: 'XAF' },
      itemCount: 1,
    })
    expect(summary.totalAdjusted.amount).toBe(0)
    expect(summary.balanceDue.amount).toBe(75000)
  })

  test('throws for negative itemCount', () => {
    expect(() => new StudentFeeSummary({
      totalExpected: { amount: 1000, currency: 'XAF' },
      totalPaid: { amount: 0, currency: 'XAF' },
      totalOverdue: { amount: 0, currency: 'XAF' },
      itemCount: -1,
    })).toThrow(DomainValidationError)
  })
})
