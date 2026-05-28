import { describe, expect, it } from 'bun:test'
import { Fee, FeeCategory } from '../../../src/entities/finances/fee'
import { DomainValidationError } from '../../../src/entities/utils'

describe('Fee amount and installment validations', () => {
  const baseArgs = {
    id: 'fee-1',
    schoolId: 'school-1',
    academicYearId: 'year-1',
    name: 'Tuition Q1',
    defaultAmount: 50000,
    currency: 'XAF',
  }

  it('successfully creates fee with valid arguments', () => {
    const fee = new Fee(baseArgs)
    expect(fee.id).toBe('fee-1')
    expect(fee.defaultAmount.amount).toBe(50000)
    expect(fee.defaultAmount.currency).toBe('XAF')
    expect(fee.category).toBe(FeeCategory.Tuition)
    expect(fee.installments).toEqual([])
  })

  it('throws DomainValidationError when defaultAmount is negative', () => {
    expect(() => {
      new Fee({
        ...baseArgs,
        defaultAmount: -100,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws when defaultAmount is a floating point number', () => {
    expect(() => {
      new Fee({
        ...baseArgs,
        defaultAmount: 100.5,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when installment percentage is negative', () => {
    expect(() => {
      new Fee({
        ...baseArgs,
        installments: [
          { label: 'Term 1', percentage: -10 },
          { label: 'Term 2', percentage: 110 },
        ],
      })
    }).toThrow(DomainValidationError)
  })

  it('throws when installments do not total 100%', () => {
    expect(() => {
      new Fee({
        ...baseArgs,
        installments: [
          { label: 'Term 1', percentage: 40 },
          { label: 'Term 2', percentage: 50 },
        ],
      })
    }).toThrow('installment percentages must total 100')
  })

  it('creates fee when installments sum exactly to 100%', () => {
    const fee = new Fee({
      ...baseArgs,
      installments: [
        { label: 'Term 1', percentage: 33.33 },
        { label: 'Term 2', percentage: 33.33 },
        { label: 'Term 3', percentage: 33.34 },
      ],
    })
    expect(fee.installments.length).toBe(3)
  })
})
