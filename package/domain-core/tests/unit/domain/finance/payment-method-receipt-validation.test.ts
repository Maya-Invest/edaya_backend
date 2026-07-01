import { describe, expect, it } from 'bun:test'
import { Payment, PaymentMethod, PaymentStatus } from '../../../../src/domain/finances/payment'

describe('Payment entity method and receipt validation', () => {
  const defaultArgs = {
    id: 'payment-1',
    studentFeeId: 'fee-1',
    amount: 5000,
    currency: 'XAF',
    paymentDate: new Date(),
    method: PaymentMethod.Cash,
  }

  it('instantiates successfully with valid inputs and defaults status to Recorded', () => {
    const payment = new Payment(defaultArgs)

    expect(payment.id).toBe('payment-1')
    expect(payment.studentFeeId).toBe('fee-1')
    expect(payment.amount.amount).toBe(5000)
    expect(payment.amount.currency).toBe('XAF')
    expect(payment.method).toBe(PaymentMethod.Cash)
    expect(payment.status).toBe(PaymentStatus.Recorded)
    expect(payment.createdAt).toBeInstanceOf(Date)
  })

  it('handles optional fields correctly', () => {
    const paymentDate = new Date()
    const payment = new Payment({
      ...defaultArgs,
      reference: 'TXN-999',
      notes: 'Monthly tuition payment',
      recordedById: 'operator-1',
      paymentDate,
    })

    expect(payment.reference).toBe('TXN-999')
    expect(payment.notes).toBe('Monthly tuition payment')
    expect(payment.recordedById).toBe('operator-1')
    expect(payment.paymentDate).toBe(paymentDate)
  })

  it('throws error when required fields are blank or negative', () => {
    expect(() => new Payment({ ...defaultArgs, id: '' })).toThrow()
    expect(() => new Payment({ ...defaultArgs, studentFeeId: ' ' })).toThrow()
    expect(() => new Payment({ ...defaultArgs, currency: '\t' })).toThrow()
    expect(() => new Payment({ ...defaultArgs, amount: -100 })).toThrow()
  })

  it('validates Reversed status criteria', () => {
    const reversedDate = new Date()
    // Happy path for Reversed
    const reversedPayment = new Payment({
      ...defaultArgs,
      status: PaymentStatus.Reversed,
      reversedAt: reversedDate,
      reversedById: 'admin-1',
    })
    expect(reversedPayment.status).toBe(PaymentStatus.Reversed)
    expect(reversedPayment.reversedAt).toBe(reversedDate)
    expect(reversedPayment.reversedById).toBe('admin-1')

    // Throws if missing reversedAt or reversedById
    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Reversed,
      reversedAt: reversedDate,
    })).toThrow('reversedAt and reversedById are required for reversed payments')

    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Reversed,
      reversedById: 'admin-1',
    })).toThrow('reversedAt and reversedById are required for reversed payments')
  })

  it('validates Cancelled status criteria', () => {
    const cancelledDate = new Date()
    // Happy path for Cancelled
    const cancelledPayment = new Payment({
      ...defaultArgs,
      status: PaymentStatus.Cancelled,
      cancelledAt: cancelledDate,
      cancelledById: 'admin-2',
    })
    expect(cancelledPayment.status).toBe(PaymentStatus.Cancelled)
    expect(cancelledPayment.cancelledAt).toBe(cancelledDate)
    expect(cancelledPayment.cancelledById).toBe('admin-2')

    // Throws if missing cancelledAt or cancelledById
    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Cancelled,
      cancelledAt: cancelledDate,
    })).toThrow('cancelledAt and cancelledById are required for cancelled payments')

    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Cancelled,
      cancelledById: 'admin-2',
    })).toThrow('cancelledAt and cancelledById are required for cancelled payments')
  })

  it('throws error if Recorded payment has reversal or cancellation audit fields', () => {
    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Recorded,
      reversedAt: new Date(),
    })).toThrow('recorded payments must not define reversal or cancellation audit fields')

    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Recorded,
      reversedById: 'admin-1',
    })).toThrow('recorded payments must not define reversal or cancellation audit fields')

    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Recorded,
      cancelledAt: new Date(),
    })).toThrow('recorded payments must not define reversal or cancellation audit fields')

    expect(() => new Payment({
      ...defaultArgs,
      status: PaymentStatus.Recorded,
      cancelledById: 'admin-2',
    })).toThrow('recorded payments must not define reversal or cancellation audit fields')
  })
})
