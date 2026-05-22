import type { SchoolFeeRepository } from '$lib/core/ports/school-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { FeeStatus, FeeSummary, SchoolFee } from '$lib/core/entities/templates/school-fee'

export interface FeeServiceArgs {
  studentRepository: StudentRepository
  schoolFeeRepository: SchoolFeeRepository
}

export class FeeService {
  constructor(args: FeeServiceArgs) {
    this.students = args.studentRepository
    this.fees = args.schoolFeeRepository
  }

  private readonly students: StudentRepository
  private readonly fees: SchoolFeeRepository

  async registerFee({
    id,
    schoolId,
    studentId,
    label,
    expectedAmount,
    paidAmount = 0,
    currency,
    dueDate,
    createdAt,
    referenceDate,
  }: {
    id: string
    schoolId: string
    studentId: string
    label: string
    expectedAmount: number
    paidAmount?: number
    currency: string
    dueDate?: Date
    createdAt?: Date
    referenceDate?: Date
  }): Promise<SchoolFee> {
    await this.requireStudent(studentId)
    const fee = new SchoolFee({
      id,
      schoolId,
      studentId,
      label,
      expectedAmount,
      paidAmount,
      currency,
      dueDate,
      status: this.deriveStatus({
        expectedAmount,
        paidAmount,
        dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      createdAt,
    })
    await this.fees.save(fee)
    return fee
  }

  async recordPayment({
    feeId,
    paidAmount,
    updatedAt,
    referenceDate,
  }: {
    feeId: string
    paidAmount: number
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<SchoolFee> {
    const existing = await this.fees.findById(feeId)
    if (!existing) {
      throw new Error(`Unknown fee: ${feeId}`)
    }

    const updated = existing.copyWith({
      paidAmount,
      status: this.deriveStatus({
        expectedAmount: existing.expectedAmount,
        paidAmount,
        dueDate: existing.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.fees.save(updated)
    return updated
  }

  async buildFeeSummary(studentId: string): Promise<FeeSummary> {
    const fees = await this.fees.listByStudent(studentId)
    const currency = fees[0]?.currency ?? 'XAF'
    return new FeeSummary({
      totalExpected: fees.reduce((sum, item) => sum + item.expectedAmount, 0),
      totalPaid: fees.reduce((sum, item) => sum + item.paidAmount, 0),
      totalOverdue: fees
        .filter(item => item.status === FeeStatus.Overdue)
        .reduce((sum, item) => sum + item.balanceDue, 0),
      itemCount: fees.length,
      currency,
    })
  }

  private deriveStatus({
    expectedAmount,
    paidAmount,
    dueDate,
    referenceDate,
  }: {
    expectedAmount: number
    paidAmount: number
    dueDate?: Date
    referenceDate: Date
  }): FeeStatus {
    if (paidAmount >= expectedAmount) {
      return FeeStatus.Paid
    }
    if (dueDate && dueDate.getTime() < referenceDate.getTime()) {
      return FeeStatus.Overdue
    }
    if (paidAmount > 0) {
      return FeeStatus.Partial
    }
    return FeeStatus.Pending
  }

  private async requireStudent(studentId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
  }
}
