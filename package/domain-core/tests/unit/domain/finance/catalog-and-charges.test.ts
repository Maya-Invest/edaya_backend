import {
  CatalogService,
  CatalogServiceCategory,
  CatalogServiceStatus,
  ChargeStatus,
  compareChargesForFifo,
  deriveChargeStatus,
  materializeInstallments,
  overdueInstallmentRemainder,
  parseStudentYearAccountId,
  remainingChargeObligation,
  StudentCharge,
  studentYearAccountId,
} from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('catalog service terms', () => {
  const billingTerms = { kind: 'one_time' as const, installments: [] }

  it('creates an active one-time catalog service', () => {
    const service = new CatalogService({
      id: 'cat-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      name: 'Tuition',
      defaultPrice: 60000,
      currency: 'XOF',
      billingTerms,
      status: CatalogServiceStatus.Active,
    })
    expect(service.isActive).toBe(true)
    expect(service.defaultPrice.amount).toBe(60000)
    expect(service.category).toBe(CatalogServiceCategory.Tuition)
  })

  it('rejects installment percentages that do not total 100', () => {
    expect(() => new CatalogService({
      id: 'cat-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      name: 'Tuition',
      defaultPrice: 100000,
      currency: 'XOF',
      billingTerms: {
        kind: 'one_time',
        installments: [
          { label: 'T1', percentage: 40 },
          { label: 'T2', percentage: 50 },
        ],
      },
    })).toThrow('installment percentages must total 100')
  })
})

describe('charge projections and FIFO', () => {
  function charge(id: string, expected: number, dueDate?: Date, createdAt = new Date('2026-01-01')) {
    return new StudentCharge({
      id,
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: id,
      academicYearId: 'year-1',
      label: id,
      expectedAmount: expected,
      currency: 'XOF',
      dueDate,
      status: ChargeStatus.Pending,
      createdAt,
      installments: [{ id: `${id}-1`, label: 'Due', expectedAmount: expected, dueDate }],
    })
  }

  it('orders dated charges before undated charges, then by due date, createdAt and id', () => {
    const undated = charge('undated', 1000)
    const early = charge('early', 1000, new Date('2026-02-01'), new Date('2026-01-02'))
    const late = charge('late', 1000, new Date('2026-03-01'), new Date('2026-01-01'))
    const sameDueLaterCreated = charge('same-later', 1000, new Date('2026-02-01'), new Date('2026-01-03'))
    const sorted = [undated, late, sameDueLaterCreated, early].sort(compareChargesForFifo)
    expect(sorted.map(item => item.id)).toEqual(['early', 'same-later', 'late', 'undated'])
  })

  it('attributes overdue remainder to the oldest unpaid installment', () => {
    const item = new StudentCharge({
      id: 'c1',
      schoolId: 'school-1',
      studentId: 'student-1',
      enrollmentId: 'c1',
      academicYearId: 'year-1',
      label: 'Tuition',
      expectedAmount: 100000,
      allocatedAmount: 40000,
      currency: 'XOF',
      status: ChargeStatus.Partial,
      installments: [
        { id: 'i1', label: 'T1', expectedAmount: 60000, dueDate: new Date('2026-01-01') },
        { id: 'i2', label: 'T2', expectedAmount: 40000, dueDate: new Date('2026-06-01') },
      ],
    })
    expect(overdueInstallmentRemainder(item, 40000, new Date('2026-03-01'))).toBe(20000)
    expect(remainingChargeObligation(item)).toBe(60000)
  })

  it('materializes last-installment remainder and derives waived vs paid', () => {
    const installments = materializeInstallments('c1', 100000, [
      { label: 'T1', percentage: 60 },
      { label: 'T2', percentage: 40 },
    ])
    expect(installments.map(item => item.expectedAmount)).toEqual([60000, 40000])
    expect(deriveChargeStatus({
      cancelled: false,
      expectedAmount: 100000,
      adjustmentAmount: 0,
      waiverAmount: 100000,
      settlement: 0,
      overdueRemainder: 0,
    })).toBe(ChargeStatus.Waived)
    expect(deriveChargeStatus({
      cancelled: false,
      expectedAmount: 100000,
      adjustmentAmount: 0,
      waiverAmount: 20000,
      settlement: 80000,
      overdueRemainder: 0,
    })).toBe(ChargeStatus.Paid)
  })
})

describe('student year account ids', () => {
  it('round-trips school, student, year, and currency', () => {
    const id = studentYearAccountId('sch-edaya-central', 's28', '2025', 'USD')
    expect(id).toBe('sya:sch-edaya-central:s28:2025:USD')
    expect(parseStudentYearAccountId(id, 'sch-edaya-central')).toEqual({
      schoolId: 'sch-edaya-central',
      studentId: 's28',
      academicYearId: '2025',
      currency: 'USD',
    })
    expect(parseStudentYearAccountId(id, 'other-school')).toBeUndefined()
  })
})
