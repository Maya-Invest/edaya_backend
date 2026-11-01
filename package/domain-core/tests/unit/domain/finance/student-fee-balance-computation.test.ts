import { ChargeStatus, remainingChargeObligation, StudentCharge } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('Student charge remaining obligation', () => {
  const baseArgs = {
    id: 'charge-1',
    schoolId: 'school-1',
    studentId: 'student-1',
    enrollmentId: 'charge-1',
    academicYearId: 'year-1',
    label: 'Tuition',
    expectedAmount: 100000,
    allocatedAmount: 20000,
    currency: 'XOF',
    status: ChargeStatus.Partial,
  }

  it('subtracts settlement, adjustments and waivers', () => {
    const charge = new StudentCharge({
      ...baseArgs,
      adjustmentAmount: 15000,
      adjustmentReason: 'Scholarship',
      adjustedById: 'staff-1',
      adjustedAt: new Date('2026-09-02'),
    })
    expect(remainingChargeObligation(charge)).toBe(65000)
  })

  it('is zero when cancelled', () => {
    const charge = new StudentCharge({
      ...baseArgs,
      allocatedAmount: 0,
      status: ChargeStatus.Cancelled,
      cancellationReason: 'Duplicate',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-09-02'),
    })
    expect(charge.remainingObligation.amount).toBe(0)
  })

  it('rejects adjustments above expected amount', () => {
    expect(() => new StudentCharge({
      ...baseArgs,
      adjustmentAmount: 120000,
      adjustmentReason: 'Discount',
      adjustedById: 'staff-1',
      adjustedAt: new Date(),
    })).toThrow('adjustmentAmount plus waiverAmount must not exceed expectedAmount')
  })
})
