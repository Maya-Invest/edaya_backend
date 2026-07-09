import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { AttachmentOwnerKind, Fee, FeeCategory, FeeStatus, Payment, PaymentMethod, PaymentStatus } from '@edaya/core'
import { validateFeeDelete, validateFeeSave, validatePaymentDelete, validatePaymentSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

const fee = new Fee({
  id: 'fee-1',
  schoolId: 'school-1',
  academicYearId: 'year-1',
  name: 'Tuition',
  category: FeeCategory.Tuition,
  defaultAmount: 50_000,
  currency: 'XAF',
})

const payment = new Payment({
  id: 'payment-1',
  studentFeeId: 'student-fee-1',
  amount: 10_000,
  currency: 'XAF',
  paymentDate: new Date('2026-06-01T00:00:00.000Z'),
  method: PaymentMethod.Cash,
})

describe('validateFeeSave', () => {
  test('accepts fees whose academic year belongs to the same school', async () => {
    await validateFeeSave(fee, undefined, {
      schools: { findById: mock(async () => ({ id: 'school-1' })) },
      academicYears: { findById: mock(async () => ({ id: 'year-1', schoolId: 'school-1' })) },
    } as never)
  })

  test('rejects fees whose academic year belongs to another school', async () => {
    await expect(validateFeeSave(fee, undefined, {
      schools: { findById: mock(async () => ({ id: 'school-1' })) },
      academicYears: { findById: mock(async () => ({ id: 'year-1', schoolId: 'other-school' })) },
    } as never)).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('validateFeeDelete', () => {
  test('allows delete when no student fee assignments exist', async () => {
    await validateFeeDelete(fee, {
      studentFees: { list: mock(async () => []) },
    } as never)
  })

  test('blocks delete while student fee assignments remain', async () => {
    await expect(validateFeeDelete(fee, {
      studentFees: { list: mock(async () => [{ id: 'student-fee-1' }]) },
    } as never)).rejects.toMatchObject({
      code: 'FEE_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})

describe('validatePaymentSave', () => {
  test('blocks new payments against cancelled student fees', async () => {
    await expect(validatePaymentSave(payment, undefined, {
      studentFees: {
        findById: mock(async () => ({ id: 'student-fee-1', status: FeeStatus.Cancelled })),
      },
    } as never)).rejects.toMatchObject({
      code: 'CANCELLED_FEE_PAYMENT',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('allows reversing a recorded payment', async () => {
    const existing = payment

    await validatePaymentSave(new Payment({
      id: 'payment-1',
      studentFeeId: 'student-fee-1',
      amount: 10_000,
      currency: 'XAF',
      paymentDate: new Date('2026-06-01T00:00:00.000Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Reversed,
      reversedAt: new Date('2026-06-02T00:00:00.000Z'),
      reversedById: 'admin-1',
    }), existing, {
      studentFees: {
        findById: mock(async () => ({ id: 'student-fee-1', status: FeeStatus.Pending })),
      },
    } as never)
  })
})

describe('validatePaymentDelete', () => {
  test('allows delete for recorded payments without receipt attachments', async () => {
    await validatePaymentDelete(payment, {
      attachments: { list: mock(async () => []) },
    } as never)
  })

  test('blocks delete when receipts or non-recorded status remain', async () => {
    await expect(validatePaymentDelete(new Payment({
      id: 'payment-1',
      studentFeeId: 'student-fee-1',
      amount: 10_000,
      currency: 'XAF',
      paymentDate: new Date('2026-06-01T00:00:00.000Z'),
      method: PaymentMethod.Cash,
      status: PaymentStatus.Cancelled,
      cancelledAt: new Date('2026-06-02T00:00:00.000Z'),
      cancelledById: 'admin-1',
    }), {
      attachments: { list: mock(async () => []) },
    } as never)).rejects.toMatchObject({
      code: 'PAYMENT_DELETE_BLOCKED',
    } satisfies Partial<BusinessRuleViolationError>)

    await expect(validatePaymentDelete(payment, {
      attachments: {
        list: mock(async () => [{ id: 'att-1', ownerKind: AttachmentOwnerKind.Payment, ownerId: 'payment-1' }]),
      },
    } as never)).rejects.toMatchObject({
      code: 'PAYMENT_DELETE_BLOCKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
