import { requireNonBlank, requireNonNegativeInt, requireOptionalNonBlank, requireValidDate } from '$lib/core/validation'
import { Money } from '$lib/core/value_object/money'

export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  MobileMoney = 'mobile_money',
  Other = 'other',
}

export interface PaymentArgs {
  id: string
  studentFeeId: string
  amount: number
  currency: string
  paymentDate: Date
  method: PaymentMethod
  reference?: string | null
  recordedById?: string | null
  createdAt?: Date
}

/**
 * Represents a single financial transaction made towards a StudentFee.
 */
export class Payment {
  readonly id: string
  readonly studentFeeId: string
  readonly amount: Money
  readonly paymentDate: Date
  readonly method: PaymentMethod
  readonly reference?: string
  readonly recordedById?: string
  readonly createdAt: Date

  constructor({
    id,
    studentFeeId,
    amount,
    currency,
    paymentDate,
    method,
    reference,
    recordedById,
    createdAt,
  }: PaymentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentFeeId = requireNonBlank(studentFeeId, 'studentFeeId')

    this.amount = new Money({
      amount: requireNonNegativeInt(amount, 'amount'),
      currency: requireNonBlank(currency, 'currency'),
    })

    this.paymentDate = requireValidDate(paymentDate, 'paymentDate')
    this.method = method
    this.reference = requireOptionalNonBlank(reference, 'reference')
    this.recordedById = requireOptionalNonBlank(recordedById, 'recordedById')
    this.createdAt = createdAt ?? new Date()
  }
}
