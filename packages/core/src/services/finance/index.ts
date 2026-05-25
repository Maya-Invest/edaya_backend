import type { FeeArgs } from '../../entities/finances/fee'
import type { PaymentMethod } from '../../entities/finances/payment'
import type { StudentFeeInstallment } from '../../entities/finances/student-fee'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { FeeRepository } from '../../ports/fee-repository'
import type { PaymentRepository } from '../../ports/payment-repository'
import type { StudentFeeRepository } from '../../ports/student-fee-repository'
import type { StudentRepository } from '../../ports/student-repository'
import { Fee } from '../../entities/finances/fee'
import { Payment, PaymentStatus } from '../../entities/finances/payment'
import { FeeStatus, StudentFee, StudentFeeSummary } from '../../entities/finances/student-fee'
import { Money } from '../../value_object/money'

export interface FinanceServiceArgs {
  atomicExecution: AtomicExecutionPort
  studentRepository: StudentRepository
  feeRepository: FeeRepository
  studentFeeRepository: StudentFeeRepository
  paymentRepository: PaymentRepository
}

export class FinanceService {
  constructor(args: FinanceServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.students = args.studentRepository
    this.feeDefinitions = args.feeRepository
    this.studentFees = args.studentFeeRepository
    this.payments = args.paymentRepository
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly students: StudentRepository
  private readonly feeDefinitions: FeeRepository
  private readonly studentFees: StudentFeeRepository
  private readonly payments: PaymentRepository

  async createFee(input: FeeArgs): Promise<Fee> {
    const fee = new Fee(input)
    await this.feeDefinitions.save(fee)
    return fee
  }

  async assignFeeToStudent({
    id,
    studentId,
    feeId,
    expectedAmount,
    dueDate,
    expectedPayments,
    createdAt,
    referenceDate,
  }: {
    id: string
    studentId: string
    feeId: string
    expectedAmount?: number
    dueDate?: Date
    expectedPayments?: readonly StudentFeeInstallment[]
    createdAt?: Date
    referenceDate?: Date
  }): Promise<StudentFee> {
    await this.requireStudent(studentId)
    const fee = await this.requireFee(feeId)
    const amount = expectedAmount ?? fee.defaultAmount.amount
    const studentFee = new StudentFee({
      id,
      studentId,
      feeId,
      academicYearId: fee.academicYearId,
      expectedAmount: amount,
      currency: fee.defaultAmount.currency,
      dueDate,
      expectedPayments,
      status: this.deriveStatus({ expectedAmount: amount, paidAmount: 0, dueDate, referenceDate: referenceDate ?? new Date() }),
      createdAt,
    })
    await this.studentFees.save(studentFee)
    return studentFee
  }

  async recordPayment({
    id,
    studentFeeId,
    amount,
    paymentDate,
    method,
    reference,
    notes,
    recordedById,
    createdAt,
    updatedAt,
    referenceDate,
  }: {
    id: string
    studentFeeId: string
    amount: number
    paymentDate: Date
    method: PaymentMethod
    reference?: string
    notes?: string
    recordedById?: string
    createdAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<Payment> {
    return this.atomicExecution.execute(async () => {
      const studentFee = await this.requireStudentFee(studentFeeId)
      const payment = new Payment({
        id,
        studentFeeId,
        amount,
        currency: studentFee.expectedAmount.currency,
        paymentDate,
        method,
        reference,
        notes,
        recordedById,
        createdAt,
      })
      await this.payments.save(payment)
      await this.savePaidAmount(
        studentFee,
        studentFee.paidAmount.amount + payment.amount.amount,
        updatedAt,
        referenceDate,
      )
      return payment
    })
  }

  async reversePayment({
    paymentId,
    reversedAt,
    updatedAt,
    referenceDate,
  }: {
    paymentId: string
    reversedAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<Payment> {
    return this.atomicExecution.execute(async () => {
      const payment = await this.requirePayment(paymentId)
      if (payment.status !== PaymentStatus.Recorded) {
        throw new Error(`Payment ${paymentId} cannot be reversed from status ${payment.status}`)
      }
      const studentFee = await this.requireStudentFee(payment.studentFeeId)
      const reversed = new Payment({
        id: payment.id,
        studentFeeId: payment.studentFeeId,
        amount: payment.amount.amount,
        currency: payment.amount.currency,
        paymentDate: payment.paymentDate,
        method: payment.method,
        status: PaymentStatus.Reversed,
        reference: payment.reference,
        notes: payment.notes,
        recordedById: payment.recordedById,
        reversedAt: reversedAt ?? new Date(),
        createdAt: payment.createdAt,
      })
      await this.payments.save(reversed)
      await this.savePaidAmount(
        studentFee,
        Math.max(0, studentFee.paidAmount.amount - payment.amount.amount),
        updatedAt,
        referenceDate,
      )
      return reversed
    })
  }

  async buildFeeSummary(studentId: string): Promise<StudentFeeSummary> {
    const fees = await this.studentFees.listByStudent(studentId)
    const currency = fees[0]?.expectedAmount.currency ?? 'XAF'
    const totalExpectedAmount = fees.reduce((sum, item) => sum + item.expectedAmount.amount, 0)
    const totalPaidAmount = fees.reduce((sum, item) => sum + item.paidAmount.amount, 0)
    const totalOverdueAmount = fees
      .filter(item => item.status === FeeStatus.Overdue)
      .reduce((sum, item) => sum + item.balanceDue.amount, 0)
    const totalAdjustedAmount = fees.reduce((sum, item) => sum + item.adjustmentAmount.amount, 0)
    return new StudentFeeSummary({
      totalExpected: new Money({ amount: totalExpectedAmount, currency }),
      totalPaid: new Money({ amount: totalPaidAmount, currency }),
      totalAdjusted: new Money({ amount: totalAdjustedAmount, currency }),
      totalOverdue: new Money({ amount: totalOverdueAmount, currency }),
      itemCount: fees.length,
    })
  }

  private async savePaidAmount(
    studentFee: StudentFee,
    paidAmount: number,
    updatedAt?: Date,
    referenceDate?: Date,
  ): Promise<void> {
    await this.studentFees.save(studentFee.copyWith({
      paidAmount,
      status: this.deriveStatus({
        expectedAmount: studentFee.expectedAmount.amount - studentFee.adjustmentAmount.amount,
        paidAmount,
        dueDate: studentFee.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    }))
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
    return paidAmount > 0 ? FeeStatus.Partial : FeeStatus.Pending
  }

  private async requireStudent(studentId: string): Promise<void> {
    if (!await this.students.findById(studentId)) {
      throw new Error(`Unknown student: ${studentId}`)
    }
  }

  private async requireFee(feeId: string): Promise<Fee> {
    const fee = await this.feeDefinitions.findById(feeId)
    if (!fee) {
      throw new Error(`Unknown fee: ${feeId}`)
    }
    return fee
  }

  private async requireStudentFee(studentFeeId: string): Promise<StudentFee> {
    const fee = await this.studentFees.findById(studentFeeId)
    if (!fee) {
      throw new Error(`Unknown student fee: ${studentFeeId}`)
    }
    return fee
  }

  private async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.payments.findById(paymentId)
    if (!payment) {
      throw new Error(`Unknown payment: ${paymentId}`)
    }
    return payment
  }
}
