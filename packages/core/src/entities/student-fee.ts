import { requireNonBlank, requireNonNegativeInt, requireValidDate } from '../validation'
import { Money } from '../value_object/money'

export enum FeeStatus {
  Pending = 'pending',
  Partial = 'partial',
  Paid = 'paid',
  Overdue = 'overdue',
  Cancelled = 'cancelled',
}

export interface StudentFeeInstallment {
  id: string
  label: string
  expectedAmount: number
  dueDate?: Date | null
}

export interface StudentFeeArgs {
  id: string
  studentId: string
  feeId: string
  academicYearId: string
  expectedAmount: number
  currency: string
  dueDate?: Date | null
  status: FeeStatus
  expectedPayments?: readonly StudentFeeInstallment[]
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Represents the assignment of a Fee to a specific Student.
 * Scoped to an academic year for year-based queries.
 * Tracks the expected amount (which might be discounted) and payment schedule.
 * Note: Actual payments made are tracked in separate Payment entities.
 */
export class StudentFee {
  readonly id: string
  readonly studentId: string
  readonly feeId: string
  readonly academicYearId: string
  readonly expectedAmount: Money
  readonly dueDate?: Date
  readonly status: FeeStatus
  readonly expectedPayments: readonly StudentFeeInstallment[]
  readonly createdAt: Date
  readonly updatedAt?: Date

  constructor({
    id,
    studentId,
    feeId,
    academicYearId,
    expectedAmount,
    currency,
    dueDate,
    status,
    expectedPayments = [],
    createdAt,
    updatedAt,
  }: StudentFeeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.feeId = requireNonBlank(feeId, 'feeId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')

    this.expectedAmount = new Money({
      amount: requireNonNegativeInt(expectedAmount, 'expectedAmount'),
      currency: requireNonBlank(currency, 'currency'),
    })

    this.dueDate = dueDate ? requireValidDate(dueDate, 'dueDate') : undefined
    this.status = status

    this.expectedPayments = Object.freeze(
      expectedPayments.map(inst => ({
        id: requireNonBlank(inst.id, 'installment.id'),
        label: requireNonBlank(inst.label, 'installment.label'),
        expectedAmount: requireNonNegativeInt(inst.expectedAmount, 'installment.expectedAmount'),
        dueDate: inst.dueDate ? requireValidDate(inst.dueDate, 'installment.dueDate') : undefined,
      })),
    )

    this.createdAt = createdAt ?? new Date()
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : undefined

    if (this.status === FeeStatus.Overdue) {
      if (!this.dueDate) {
        throw new Error('overdue fees must define a dueDate')
      }
    }
  }
}
