import { requireNonBlank, requireNonNegativeInt, requireValidDate } from '../../utils/validation'
import { Money } from '../../value_object/money'

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
  paidAmount?: number | null
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
 * Tracks the expected amount (which might be discounted), paid amount, and payment schedule.
 * Note: Actual payments made are tracked in separate Payment entities.
 */
export class StudentFee {
  readonly id: string
  readonly studentId: string
  readonly feeId: string
  readonly academicYearId: string
  readonly expectedAmount: Money
  readonly paidAmount: Money
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
    paidAmount = 0,
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

    const activeCurrency = requireNonBlank(currency, 'currency')
    this.expectedAmount = new Money({
      amount: requireNonNegativeInt(expectedAmount, 'expectedAmount'),
      currency: activeCurrency,
    })

    this.paidAmount = new Money({
      amount: requireNonNegativeInt(paidAmount ?? 0, 'paidAmount'),
      currency: activeCurrency,
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

  get balanceDue(): Money {
    return new Money({
      amount: Math.max(0, this.expectedAmount.amount - this.paidAmount.amount),
      currency: this.expectedAmount.currency,
    })
  }

  copyWith(changes: Partial<StudentFeeArgs>): StudentFee {
    return new StudentFee({
      id: this.id,
      studentId: this.studentId,
      feeId: this.feeId,
      academicYearId: this.academicYearId,
      expectedAmount: changes.expectedAmount ?? this.expectedAmount.amount,
      paidAmount: changes.paidAmount ?? this.paidAmount.amount,
      currency: this.expectedAmount.currency,
      dueDate: changes.dueDate !== undefined ? changes.dueDate : this.dueDate,
      status: changes.status ?? this.status,
      expectedPayments: this.expectedPayments,
      createdAt: this.createdAt,
      updatedAt: changes.updatedAt !== undefined ? changes.updatedAt : this.updatedAt,
    })
  }
}

export class StudentFeeSummary {
  readonly totalExpected: Money
  readonly totalPaid: Money
  readonly totalOverdue: Money
  readonly balanceDue: Money
  readonly itemCount: number

  constructor(args: {
    totalExpected: Money
    totalPaid: Money
    totalOverdue: Money
    itemCount: number
  }) {
    this.totalExpected = args.totalExpected
    this.totalPaid = args.totalPaid
    this.totalOverdue = args.totalOverdue
    this.balanceDue = new Money({
      amount: Math.max(0, args.totalExpected.amount - args.totalPaid.amount),
      currency: args.totalExpected.currency,
    })
    this.itemCount = args.itemCount
  }
}
