import { Money } from '../../value_object/money'
import { requireNonBlank, requireNonNegativeInt, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  MobileMoney = 'mobile_money',
  Other = 'other',
}

export enum PaymentStatus {
  Recorded = 'recorded',
  Reversed = 'reversed',
  Cancelled = 'cancelled',
}

export interface PaymentArgs {
  id: string
  studentFeeId: string
  amount: number
  currency: string
  paymentDate: Date
  method: PaymentMethod
  status?: PaymentStatus
  reference?: string | null
  notes?: string | null
  recordedById?: string | null
  reversedAt?: Date | null
  cancelledAt?: Date | null
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
  readonly status: PaymentStatus
  readonly reference?: string
  readonly notes?: string
  readonly recordedById?: string
  readonly reversedAt?: Date
  readonly cancelledAt?: Date
  readonly createdAt: Date

  constructor({
    id,
    studentFeeId,
    amount,
    currency,
    paymentDate,
    method,
    status = PaymentStatus.Recorded,
    reference,
    notes,
    recordedById,
    reversedAt,
    cancelledAt,
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
    this.status = status
    this.reference = requireOptionalNonBlank(reference, 'reference')
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.recordedById = requireOptionalNonBlank(recordedById, 'recordedById')
    this.reversedAt = reversedAt ? requireValidDate(reversedAt, 'reversedAt') : undefined
    this.cancelledAt = cancelledAt ? requireValidDate(cancelledAt, 'cancelledAt') : undefined
    this.createdAt = createdAt ?? new Date()

    if (this.status === PaymentStatus.Reversed && !this.reversedAt) {
      throw new Error('reversedAt is required for reversed payments')
    }
    if (this.status === PaymentStatus.Cancelled && !this.cancelledAt) {
      throw new Error('cancelledAt is required for cancelled payments')
    }
    if (this.status === PaymentStatus.Recorded && (this.reversedAt || this.cancelledAt)) {
      throw new Error('recorded payments must not define reversedAt or cancelledAt')
    }
  }
}
