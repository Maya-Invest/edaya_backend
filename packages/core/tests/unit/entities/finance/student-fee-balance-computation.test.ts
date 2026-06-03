import { describe, expect, it } from 'bun:test'
import { buildStudentFeeSummary, FeeStatus, StudentFee } from '../../../../src/entities/finances/student-fee'

describe('Student fee balance computation and state transitions', () => {
  const baseArgs = {
    id: 'student-fee-1',
    studentId: 'student-1',
    feeId: 'fee-1',
    academicYearId: 'year-1',
    expectedAmount: 100000,
    paidAmount: 20000,
    currency: 'XAF',
    status: FeeStatus.Pending,
  }

  it('correctly calculates balanceDue without adjustments', () => {
    const fee = new StudentFee(baseArgs)
    expect(fee.balanceDue.amount).toBe(80000)
    expect(fee.balanceDue.currency).toBe('XAF')
  })

  it('correctly calculates balanceDue with adjustments', () => {
    const fee = new StudentFee({
      ...baseArgs,
      adjustmentAmount: 15000,
      adjustmentReason: 'Scholarship discount',
      adjustedById: 'staff-1',
      adjustedAt: new Date('2026-09-02'),
    })
    expect(fee.balanceDue.amount).toBe(65000) // 100000 - 15000 - 20000
  })

  it('sets balanceDue to 0 if status is Cancelled', () => {
    const fee = new StudentFee({
      ...baseArgs,
      status: FeeStatus.Cancelled,
      cancellationReason: 'Accidental assignment',
      cancelledById: 'staff-1',
      cancelledAt: new Date('2026-09-02'),
    })
    expect(fee.balanceDue.amount).toBe(0)
  })

  it('throws error when adjustmentAmount exceeds expectedAmount', () => {
    expect(() => {
      new StudentFee({
        ...baseArgs,
        adjustmentAmount: 120000,
        adjustmentReason: 'Discount',
        adjustedById: 'staff-1',
        adjustedAt: new Date(),
      })
    }).toThrow('adjustmentAmount must not exceed expectedAmount')
  })

  it('throws error when adjustment is recorded without audit fields', () => {
    expect(() => {
      new StudentFee({
        ...baseArgs,
        adjustmentAmount: 10000,
        adjustmentReason: 'Discount',
      })
    }).toThrow('adjustedById and adjustedAt are required for adjusted student fees')
  })

  it('throws error when no adjustment exists but audit fields are defined', () => {
    expect(() => {
      new StudentFee({
        ...baseArgs,
        adjustmentAmount: 0,
        adjustedById: 'staff-1',
        adjustedAt: new Date(),
      })
    }).toThrow('unadjusted student fees must not define adjustment audit fields')
  })

  it('throws error for Cancelled status without cancellation audit fields', () => {
    expect(() => {
      new StudentFee({
        ...baseArgs,
        status: FeeStatus.Cancelled,
      })
    }).toThrow('cancellation reason, actor, and date are required for cancelled student fees')
  })

  it('copies with changes correctly using copyWith', () => {
    const fee = new StudentFee(baseArgs)
    const updated = fee.copyWith({
      paidAmount: 50000,
      status: FeeStatus.Partial,
    })
    expect(updated.paidAmount.amount).toBe(50000)
    expect(updated.status).toBe(FeeStatus.Partial)
    expect(updated.balanceDue.amount).toBe(50000)
  })

  it('buildStudentFeeSummary correctly aggregates active fees', () => {
    const fee1 = new StudentFee({
      id: 'f-1',
      studentId: 'student-1',
      feeId: 'fee-1',
      academicYearId: 'year-1',
      expectedAmount: 100000,
      paidAmount: 40000,
      currency: 'XAF',
      status: FeeStatus.Partial,
    })

    const fee2 = new StudentFee({
      id: 'f-2',
      studentId: 'student-1',
      feeId: 'fee-2',
      academicYearId: 'year-1',
      expectedAmount: 50000,
      paidAmount: 0,
      dueDate: new Date('2026-10-01'),
      currency: 'XAF',
      status: FeeStatus.Overdue,
    })

    const fee3 = new StudentFee({
      id: 'f-3',
      studentId: 'student-1',
      feeId: 'fee-3',
      academicYearId: 'year-1',
      expectedAmount: 30000,
      paidAmount: 0,
      currency: 'XAF',
      status: FeeStatus.Cancelled,
      cancellationReason: 'Duplicate',
      cancelledById: 'staff-1',
      cancelledAt: new Date(),
    })

    const summary = buildStudentFeeSummary([fee1, fee2, fee3])

    expect(summary.totalExpected.amount).toBe(150000) // fee1 + fee2 (fee3 is cancelled)
    expect(summary.totalPaid.amount).toBe(40000)
    expect(summary.totalOverdue.amount).toBe(50000)
    expect(summary.balanceDue.amount).toBe(110000) // 150000 - 40000
    expect(summary.itemCount).toBe(3)
  })

  it('validates installments correctly', () => {
    const fee = new StudentFee({
      ...baseArgs,
      expectedAmount: 100000,
      installments: [
        { id: 'inst-1', label: 'Term 1', expectedAmount: 50000, dueDate: new Date() },
        { id: 'inst-2', label: 'Term 2', expectedAmount: 50000, dueDate: new Date() },
      ],
    })
    expect(fee.installments.length).toBe(2)
  })

  it('throws error when installment expected amounts do not total expectedAmount', () => {
    expect(() => {
      new StudentFee({
        ...baseArgs,
        expectedAmount: 100000,
        installments: [
          { id: 'inst-1', label: 'Term 1', expectedAmount: 50000 },
          { id: 'inst-2', label: 'Term 2', expectedAmount: 40000 },
        ],
      })
    }).toThrow('installment expected amounts must total expectedAmount')
  })
})
