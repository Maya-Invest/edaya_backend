import type { StudentFeeInstallment } from '$lib/core/entities/finance/student-fee'
import type { StudentFeeRepository } from '$lib/core/ports/student-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { FeeStatus, StudentFee, StudentFeeSummary } from '$lib/core/entities/finance/student-fee'
import { Money } from '$lib/core/value_object/money'

export interface FeeServiceArgs {
  studentRepository: StudentRepository
  studentFeeRepository: StudentFeeRepository
}

export class FeeService {
  constructor(args: FeeServiceArgs) {
    this.students = args.studentRepository
    this.fees = args.studentFeeRepository
  }

  private readonly students: StudentRepository
  private readonly fees: StudentFeeRepository

  async registerFee({
    id,
    studentId,
    feeId,
    academicYearId,
    expectedAmount,
    paidAmount = 0,
    currency,
    dueDate,
    expectedPayments,
    createdAt,
    referenceDate,
  }: {
    id: string
    studentId: string
    feeId: string
    academicYearId: string
    expectedAmount: number
    paidAmount?: number
    currency: string
    dueDate?: Date
    expectedPayments?: readonly StudentFeeInstallment[]
    createdAt?: Date
    referenceDate?: Date
  }): Promise<StudentFee> {
    await this.requireStudent(studentId)
    const fee = new StudentFee({
      id,
      studentId,
      feeId,
      academicYearId,
      expectedAmount,
      paidAmount,
      currency,
      dueDate,
      expectedPayments,
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
  }): Promise<StudentFee> {
    const existing = await this.fees.findById(feeId)
    if (!existing) {
      throw new Error(`Unknown fee: ${feeId}`)
    }

    const updated = existing.copyWith({
      paidAmount,
      status: this.deriveStatus({
        expectedAmount: existing.expectedAmount.amount,
        paidAmount,
        dueDate: existing.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.fees.save(updated)
    return updated
  }

  async buildFeeSummary(studentId: string): Promise<StudentFeeSummary> {
    const fees = await this.fees.listByStudent(studentId)
    const currency = fees[0]?.expectedAmount.currency ?? 'XAF'

    const totalExpectedAmount = fees.reduce((sum, item) => sum + item.expectedAmount.amount, 0)
    const totalPaidAmount = fees.reduce((sum, item) => sum + item.paidAmount.amount, 0)
    const totalOverdueAmount = fees
      .filter(item => item.status === FeeStatus.Overdue)
      .reduce((sum, item) => sum + item.balanceDue.amount, 0)

    return new StudentFeeSummary({
      totalExpected: new Money({ amount: totalExpectedAmount, currency }),
      totalPaid: new Money({ amount: totalPaidAmount, currency }),
      totalOverdue: new Money({ amount: totalOverdueAmount, currency }),
      itemCount: fees.length,
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
