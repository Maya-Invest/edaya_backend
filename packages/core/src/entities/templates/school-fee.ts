import { requireNonBlank, requireNonNegativeInt, requireValidDate } from '../../validation'

export enum FeeStatus {
  Pending = 'pending',
  Partial = 'partial',
  Paid = 'paid',
  Overdue = 'overdue',
  Cancelled = 'cancelled',
}

export interface SchoolFeeArgs {
  id: string
  schoolId: string
  studentId: string
  label: string
  expectedAmount: number
  paidAmount: number
  currency: string
  status: FeeStatus
  dueDate?: Date | null
  createdAt?: Date | null
  updatedAt?: Date | null
}

export class SchoolFee {
  readonly id: string
  readonly schoolId: string
  readonly studentId: string
  readonly label: string
  readonly expectedAmount: number
  readonly paidAmount: number
  readonly currency: string
  readonly status: FeeStatus
  readonly dueDate?: Date
  readonly createdAt: Date
  readonly updatedAt?: Date

  constructor({
    id,
    schoolId,
    studentId,
    label,
    expectedAmount,
    paidAmount,
    currency,
    status,
    dueDate,
    createdAt,
    updatedAt,
  }: SchoolFeeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.label = requireNonBlank(label, 'label')
    this.expectedAmount = requireNonNegativeInt(expectedAmount, 'expectedAmount')
    this.paidAmount = requireNonNegativeInt(paidAmount, 'paidAmount')
    this.currency = requireNonBlank(currency, 'currency')
    this.status = status
    this.dueDate = dueDate ? requireValidDate(dueDate, 'dueDate') : undefined
    this.createdAt = createdAt ?? new Date()
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : undefined
  }

  get balanceDue(): number {
    return Math.max(0, this.expectedAmount - this.paidAmount)
  }

  copyWith(changes: Partial<SchoolFeeArgs>): SchoolFee {
    return new SchoolFee({
      id: this.id,
      schoolId: this.schoolId,
      studentId: this.studentId,
      label: this.label,
      expectedAmount: this.expectedAmount,
      paidAmount: changes.paidAmount !== undefined ? changes.paidAmount : this.paidAmount,
      currency: this.currency,
      status: changes.status !== undefined ? changes.status : this.status,
      dueDate: this.dueDate,
      createdAt: this.createdAt,
      updatedAt: changes.updatedAt !== undefined ? changes.updatedAt : this.updatedAt,
    })
  }
}

export class FeeSummary {
  readonly totalExpected: number
  readonly totalPaid: number
  readonly totalOverdue: number
  readonly balanceDue: number
  readonly itemCount: number
  readonly currency: string

  constructor(args: {
    totalExpected: number
    totalPaid: number
    totalOverdue: number
    itemCount: number
    currency: string
  }) {
    this.totalExpected = args.totalExpected
    this.totalPaid = args.totalPaid
    this.totalOverdue = args.totalOverdue
    this.balanceDue = args.totalExpected - args.totalPaid
    this.itemCount = args.itemCount
    this.currency = args.currency
  }
}
