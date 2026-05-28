import type { FeeArgs } from '../../entities/finances/fee'
import type { PaymentMethod } from '../../entities/finances/payment'
import type { StudentFeeInstallment, StudentFeeSummary } from '../../entities/finances/student-fee'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Fee } from '../../entities/finances/fee'
import { Payment, PaymentStatus } from '../../entities/finances/payment'
import { buildStudentFeeSummary, FeeStatus, StudentFee } from '../../entities/finances/student-fee'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'

export class FinanceService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.repositories = args.repositories
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly repositories: SchoolRepositories
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  async createFee(input: FeeArgs): Promise<Fee> {
    await this.authorize('finance.manage', { schoolId: input.schoolId })
    const [school, academicYear] = await Promise.all([
      this.repositories.schools.findById(input.schoolId),
      this.repositories.academicYears.findById(input.academicYearId),
    ])
    if (!school || !academicYear || academicYear.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    const fee = new Fee(input)
    await this.repositories.fees.save(fee)
    return fee
  }

  async assignFeeToStudent({
    id,
    studentId,
    feeId,
    expectedAmount,
    dueDate,
    createdAt,
    referenceDate,
  }: {
    id: string
    studentId: string
    feeId: string
    expectedAmount?: number
    dueDate?: Date
    createdAt?: Date
    referenceDate?: Date
  }): Promise<StudentFee> {
    const student = await this.requireStudent(studentId)
    await this.authorize('finance.manage', {
      schoolId: student.schoolId,
      studentId: student.id,
    })
    const fee = await this.requireFee(feeId)
    if (fee.schoolId !== student.schoolId) {
      denyResourceAccess()
    }
    const amount = expectedAmount ?? fee.defaultAmount.amount
    const installments = this.materializeInstallments(id, amount, fee)
    const effectiveDueDate = dueDate ?? installments.at(-1)?.dueDate ?? undefined
    const studentFee = new StudentFee({
      id,
      studentId,
      feeId,
      academicYearId: fee.academicYearId,
      expectedAmount: amount,
      currency: fee.defaultAmount.currency,
      dueDate: effectiveDueDate,
      installments,
      status: this.deriveStatus({ expectedAmount: amount, paidAmount: 0, dueDate: effectiveDueDate, referenceDate: referenceDate ?? new Date() }),
      createdAt,
    })
    await this.repositories.studentFees.save(studentFee)
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
    createdAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<Payment> {
    return this.atomicExecution.execute(async () => {
      const studentFee = await this.requireStudentFee(studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      await this.authorize('finance.manage', {
        schoolId: student.schoolId,
        studentId: student.id,
        studentFeeId,
      })
      if (studentFee.status === FeeStatus.Cancelled) {
        throw new Error(`Student fee ${studentFeeId} cannot receive payments after cancellation`)
      }
      const payment = new Payment({
        id,
        studentFeeId,
        amount,
        currency: studentFee.expectedAmount.currency,
        paymentDate,
        method,
        reference,
        notes,
        recordedById: resolveAuditActorId(this.actor),
        createdAt,
      })
      await this.repositories.payments.save(payment)
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
      const studentFee = await this.requireStudentFee(payment.studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      await this.authorize('finance.manage', {
        schoolId: student.schoolId,
        studentId: student.id,
        studentFeeId: studentFee.id,
      })
      if (payment.status !== PaymentStatus.Recorded) {
        throw new Error(`Payment ${paymentId} cannot be reversed from status ${payment.status}`)
      }
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
        reversedById: resolveAuditActorId(this.actor),
        createdAt: payment.createdAt,
      })
      await this.repositories.payments.save(reversed)
      await this.savePaidAmount(
        studentFee,
        Math.max(0, studentFee.paidAmount.amount - payment.amount.amount),
        updatedAt,
        referenceDate,
      )
      return reversed
    })
  }

  async cancelPayment({
    paymentId,
    cancelledAt,
    updatedAt,
    referenceDate,
  }: {
    paymentId: string
    cancelledAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<Payment> {
    return this.atomicExecution.execute(async () => {
      const payment = await this.requirePayment(paymentId)
      const studentFee = await this.requireStudentFee(payment.studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      await this.authorize('finance.manage', {
        schoolId: student.schoolId,
        studentId: student.id,
        studentFeeId: studentFee.id,
      })
      if (payment.status !== PaymentStatus.Recorded) {
        throw new Error(`Payment ${paymentId} cannot be cancelled from status ${payment.status}`)
      }
      const cancelled = new Payment({
        id: payment.id,
        studentFeeId: payment.studentFeeId,
        amount: payment.amount.amount,
        currency: payment.amount.currency,
        paymentDate: payment.paymentDate,
        method: payment.method,
        status: PaymentStatus.Cancelled,
        reference: payment.reference,
        notes: payment.notes,
        recordedById: payment.recordedById,
        cancelledAt: cancelledAt ?? new Date(),
        cancelledById: resolveAuditActorId(this.actor),
        createdAt: payment.createdAt,
      })
      await this.repositories.payments.save(cancelled)
      await this.savePaidAmount(
        studentFee,
        Math.max(0, studentFee.paidAmount.amount - payment.amount.amount),
        updatedAt,
        referenceDate,
      )
      return cancelled
    })
  }

  async adjustStudentFee({
    studentFeeId,
    adjustmentAmount,
    reason,
    adjustedAt,
    updatedAt,
    referenceDate,
  }: {
    studentFeeId: string
    adjustmentAmount: number
    reason: string
    adjustedAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<StudentFee> {
    const studentFee = await this.requireStudentFee(studentFeeId)
    const student = await this.requireStudent(studentFee.studentId)
    await this.authorize('finance.manage', {
      schoolId: student.schoolId,
      studentId: student.id,
      studentFeeId: studentFee.id,
    })
    if (studentFee.status === FeeStatus.Cancelled) {
      throw new Error(`Student fee ${studentFeeId} cannot be adjusted after cancellation`)
    }
    if (studentFee.adjustmentAmount.amount > 0) {
      throw new Error(`Student fee ${studentFeeId} has already been adjusted`)
    }
    if (adjustmentAmount <= 0) {
      throw new Error('adjustmentAmount must be strictly positive')
    }
    if (adjustmentAmount > studentFee.expectedAmount.amount - studentFee.paidAmount.amount) {
      throw new Error('adjustmentAmount must not reduce a fee below its paid amount')
    }
    const adjusted = studentFee.copyWith({
      adjustmentAmount,
      adjustmentReason: reason,
      adjustedById: resolveAuditActorId(this.actor),
      adjustedAt: adjustedAt ?? new Date(),
      status: this.deriveStatus({
        expectedAmount: studentFee.expectedAmount.amount - adjustmentAmount,
        paidAmount: studentFee.paidAmount.amount,
        dueDate: studentFee.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.repositories.studentFees.save(adjusted)
    return adjusted
  }

  async cancelStudentFee({
    studentFeeId,
    reason,
    cancelledAt,
    updatedAt,
  }: {
    studentFeeId: string
    reason: string
    cancelledAt?: Date
    updatedAt?: Date
  }): Promise<StudentFee> {
    const studentFee = await this.requireStudentFee(studentFeeId)
    const student = await this.requireStudent(studentFee.studentId)
    await this.authorize('finance.manage', {
      schoolId: student.schoolId,
      studentId: student.id,
      studentFeeId: studentFee.id,
    })
    if (studentFee.status === FeeStatus.Cancelled) {
      throw new Error(`Student fee ${studentFeeId} has already been cancelled`)
    }
    if (studentFee.paidAmount.amount > 0) {
      throw new Error(`Student fee ${studentFeeId} cannot be cancelled while recorded payments remain`)
    }
    const cancelled = studentFee.copyWith({
      status: FeeStatus.Cancelled,
      cancellationReason: reason,
      cancelledById: resolveAuditActorId(this.actor),
      cancelledAt: cancelledAt ?? new Date(),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.repositories.studentFees.save(cancelled)
    return cancelled
  }

  async buildFeeSummary(studentId: string): Promise<StudentFeeSummary> {
    const student = await this.requireStudent(studentId)
    await this.authorize('finance.read', { schoolId: student.schoolId, studentId })
    const fees = await this.repositories.studentFees.list({ studentId })
    return buildStudentFeeSummary(fees)
  }

  private materializeInstallments(id: string, amount: number, fee: Fee): StudentFeeInstallment[] {
    let assignedAmount = 0
    return fee.installments.map((template, index) => {
      const isLast = index === fee.installments.length - 1
      const expectedAmount = isLast
        ? amount - assignedAmount
        : Math.round((amount * template.percentage) / 100)
      assignedAmount += expectedAmount
      return {
        id: `${id}-installment-${index + 1}`,
        label: template.label,
        expectedAmount,
        dueDate: template.dueDate,
      }
    })
  }

  private async savePaidAmount(
    studentFee: StudentFee,
    paidAmount: number,
    updatedAt?: Date,
    referenceDate?: Date,
  ): Promise<void> {
    await this.repositories.studentFees.save(studentFee.copyWith({
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

  private async requireStudent(studentId: string) {
    const student = await this.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireFee(feeId: string): Promise<Fee> {
    const fee = await this.repositories.fees.findById(feeId)
    if (!fee) {
      denyResourceAccess()
    }
    return fee
  }

  private async requireStudentFee(studentFeeId: string): Promise<StudentFee> {
    const fee = await this.repositories.studentFees.findById(studentFeeId)
    if (!fee) {
      denyResourceAccess()
    }
    return fee
  }

  private async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.repositories.payments.findById(paymentId)
    if (!payment) {
      denyResourceAccess()
    }
    return payment
  }

  private async authorize(
    action: 'finance.manage' | 'finance.read',
    resource: { schoolId: string, studentId?: string, studentFeeId?: string },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
