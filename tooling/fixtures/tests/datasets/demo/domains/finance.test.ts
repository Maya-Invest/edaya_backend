import type { FeeInput, PaymentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoFees, demoPayments, demoStudentFees } from '../../../../src/datasets/demo/domains/finance'

describe('demo finance', () => {
  it('typed fees satisfy FeeInput', () => {
    const fee = demoFees[0] satisfies FeeInput
    expect(fee.defaultAmount).toBe(4800)
  })

  it('typed payments satisfy PaymentInput', () => {
    const payment = demoPayments[0] satisfies PaymentInput
    expect(payment.studentFeeId).toBe('b1')
  })

  it('includes fees, student fees, and payments', () => {
    expect(demoFees.length).toBeGreaterThan(0)
    expect(demoStudentFees.length).toBeGreaterThan(0)
    expect(demoPayments.length).toBeGreaterThan(0)
  })
})
