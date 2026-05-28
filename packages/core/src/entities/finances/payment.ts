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
  reversedById?: string | null
  cancelledAt?: Date | null
  cancelledById?: string | null
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
  readonly reversedById?: string
  readonly cancelledAt?: Date
  readonly cancelledById?: string
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
    reversedById,
    cancelledAt,
    cancelledById,
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
    this.reversedById = requireOptionalNonBlank(reversedById, 'reversedById')
    this.cancelledAt = cancelledAt ? requireValidDate(cancelledAt, 'cancelledAt') : undefined
    this.cancelledById = requireOptionalNonBlank(cancelledById, 'cancelledById')
    this.createdAt = createdAt ?? new Date()

    if (this.status === PaymentStatus.Reversed && (!this.reversedAt || !this.reversedById)) {
      throw new Error('reversedAt and reversedById are required for reversed payments')
    }
    if (this.status === PaymentStatus.Cancelled && (!this.cancelledAt || !this.cancelledById)) {
      throw new Error('cancelledAt and cancelledById are required for cancelled payments')
    }
    if (this.status === PaymentStatus.Recorded && (this.reversedAt || this.reversedById || this.cancelledAt || this.cancelledById)) {
      throw new Error('recorded payments must not define reversal or cancellation audit fields')
    }
  }
}
