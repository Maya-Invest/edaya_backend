import { Payment, PaymentKind, PaymentMethod, PaymentStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('Payment receipts and disbursements', () => {
  const defaultArgs = {
    id: 'payment-1',
    schoolId: 'school-1',
    accountId: 'sya:school-1:student-1:year-1:XOF',
    academicYearId: 'year-1',
    amount: 5000,
    currency: 'XOF',
    paymentDate: new Date(),
    method: PaymentMethod.Cash,
  }

  it('defaults to a recorded receipt', () => {
    const payment = new Payment(defaultArgs)
    expect(payment.isReceipt).toBe(true)
    expect(payment.kind).toBe(PaymentKind.Receipt)
    expect(payment.status).toBe(PaymentStatus.Recorded)
    expect(payment.accountId).toBe(defaultArgs.accountId)
  })

  it('requires reversal audit fields', () => {
    const reversedAt = new Date()
    const reversed = new Payment({
      ...defaultArgs,
      status: PaymentStatus.Reversed,
      reversedAt,
      reversedById: 'admin-1',
    })
    expect(reversed.status).toBe(PaymentStatus.Reversed)
    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Reversed,
      reversedAt,
    })).toThrow('reversedAt and reversedById are required for reversed payments')
  })

  it('rejects recorded payments that carry reversal fields', () => {
    expect(() => new Payment({
      ...defaultArgs,
      reversedAt: new Date(),
    })).toThrow('recorded payments must not define reversal audit fields')
  })

  it('rejects disbursements that reverse a receipt', () => {
    expect(() => new Payment({
      ...defaultArgs,
      kind: PaymentKind.Disbursement,
      reversesPaymentId: 'payment-0',
    })).toThrow('disbursements must not reverse a receipt')
  })
})
