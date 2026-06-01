import type { Fee } from '../../../entities/finances/fee'
import type { PaymentMethod } from '../../../entities/finances/payment'
import type { StudentFeeInstallment } from '../../../entities/finances/student-fee'
import type { BaseSchoolService } from '../base-school-service'
import { Payment, PaymentStatus } from '../../../entities/finances/payment'
import { FeeStatus, StudentFee } from '../../../entities/finances/student-fee'
import { resolveAuditActorId } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface AssignFeeToStudentInput {
  id: string
  studentId: string
  feeId: string
  expectedAmount?: number
  dueDate?: Date
  createdAt?: Date
  referenceDate?: Date
}

export interface RecordPaymentInput {
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
}

export interface UpdatePaymentStatusInput {
  paymentId: string
  reversedAt?: Date
  cancelledAt?: Date
  updatedAt?: Date
  referenceDate?: Date
}

export interface AdjustStudentFeeInput {
  studentFeeId: string
  adjustmentAmount: number
  reason: string
  adjustedAt?: Date
  updatedAt?: Date
  referenceDate?: Date
}

export interface CancelStudentFeeInput {
  studentFeeId: string
  reason: string
  cancelledAt?: Date
  updatedAt?: Date
}

export class FinanceServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async assignFeeToStudent({
    id,
    studentId,
    feeId,
    expectedAmount,
    dueDate,
    createdAt,
    referenceDate,
  }: AssignFeeToStudentInput): Promise<StudentFee> {
    const student = await this.requireStudent(studentId)
    this.checkActorSchool(student.schoolId)
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
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
      status: this.deriveFeeStatus({
        expectedAmount: amount,
        paidAmount: 0,
        dueDate: effectiveDueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      createdAt,
    })
    await this.base.studentFees.save(studentFee, { moduleChecked: true })
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
  }: RecordPaymentInput): Promise<Payment> {
    return this.base.atomicExecution.execute(async () => {
      const studentFee = await this.requireStudentFee(studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      this.checkActorSchool(student.schoolId)
      await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
      await this.base.authorizationPolicy.checkStudentFeeAccess(this.base.actor, [studentFeeId])
      if (studentFee.status === FeeStatus.Cancelled) {
        throw new BusinessRuleViolationError('CANCELLED_FEE_PAYMENT', `Student fee ${studentFeeId} cannot receive payments after cancellation`)
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
        recordedById: resolveAuditActorId(this.base.actor),
        createdAt,
      })
      await this.base.payments.save(payment, { moduleChecked: true })
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
  }: UpdatePaymentStatusInput): Promise<Payment> {
    return this.updatePaymentStatus({
      paymentId,
      status: PaymentStatus.Reversed,
      changedAt: reversedAt,
      updatedAt,
      referenceDate,
    })
  }

  async cancelPayment({
    paymentId,
    cancelledAt,
    updatedAt,
    referenceDate,
  }: UpdatePaymentStatusInput): Promise<Payment> {
    return this.updatePaymentStatus({
      paymentId,
      status: PaymentStatus.Cancelled,
      changedAt: cancelledAt,
      updatedAt,
      referenceDate,
    })
  }

  async updatePaymentStatus({
    paymentId,
    status,
    changedAt,
    updatedAt,
    referenceDate,
  }: {
    paymentId: string
    status: PaymentStatus.Cancelled | PaymentStatus.Reversed
    changedAt?: Date
    updatedAt?: Date
    referenceDate?: Date
  }): Promise<Payment> {
    return this.base.atomicExecution.execute(async () => {
      const payment = await this.requirePayment(paymentId)
      const studentFee = await this.requireStudentFee(payment.studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      this.checkActorSchool(student.schoolId)
      await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
      await this.base.authorizationPolicy.checkStudentFeeAccess(this.base.actor, [studentFee.id])
      if (payment.status !== PaymentStatus.Recorded) {
        const code = status === PaymentStatus.Reversed ? 'INVALID_PAYMENT_REVERSAL' : 'INVALID_PAYMENT_CANCELLATION'
        throw new BusinessRuleViolationError(code, `Payment ${paymentId} cannot be ${status} from status ${payment.status}`)
      }
      const changedPayment = new Payment({
        id: payment.id,
        studentFeeId: payment.studentFeeId,
        amount: payment.amount.amount,
        currency: payment.amount.currency,
        paymentDate: payment.paymentDate,
        method: payment.method,
        status,
        reference: payment.reference,
        notes: payment.notes,
        recordedById: payment.recordedById,
        reversedAt: status === PaymentStatus.Reversed ? changedAt ?? new Date() : undefined,
        reversedById: status === PaymentStatus.Reversed ? resolveAuditActorId(this.base.actor) : undefined,
        cancelledAt: status === PaymentStatus.Cancelled ? changedAt ?? new Date() : undefined,
        cancelledById: status === PaymentStatus.Cancelled ? resolveAuditActorId(this.base.actor) : undefined,
        createdAt: payment.createdAt,
      })
      await this.base.payments.save(changedPayment, { moduleChecked: true })
      await this.savePaidAmount(
        studentFee,
        Math.max(0, studentFee.paidAmount.amount - payment.amount.amount),
        updatedAt,
        referenceDate,
      )
      return changedPayment
    })
  }

  async adjustStudentFee({
    studentFeeId,
    adjustmentAmount,
    reason,
    adjustedAt,
    updatedAt,
    referenceDate,
  }: AdjustStudentFeeInput): Promise<StudentFee> {
    const studentFee = await this.requireStudentFee(studentFeeId)
    const student = await this.requireStudent(studentFee.studentId)
    this.checkActorSchool(student.schoolId)
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
    await this.base.authorizationPolicy.checkStudentFeeAccess(this.base.actor, [studentFee.id])
    if (studentFee.status === FeeStatus.Cancelled) {
      throw new BusinessRuleViolationError('CANCELLED_FEE_ADJUSTMENT', `Student fee ${studentFeeId} cannot be adjusted after cancellation`)
    }
    if (studentFee.adjustmentAmount.amount > 0) {
      throw new BusinessRuleViolationError('ALREADY_ADJUSTED_FEE', `Student fee ${studentFeeId} has already been adjusted`)
    }
    if (adjustmentAmount <= 0) {
      throw new BusinessRuleViolationError('INVALID_ADJUSTMENT_AMOUNT', 'adjustmentAmount must be strictly positive')
    }
    if (adjustmentAmount > studentFee.expectedAmount.amount - studentFee.paidAmount.amount) {
      throw new BusinessRuleViolationError('ADJUSTMENT_EXCEEDS_OUTSTANDING', 'adjustmentAmount must not reduce a fee below its paid amount')
    }
    const adjusted = studentFee.copyWith({
      adjustmentAmount,
      adjustmentReason: reason,
      adjustedById: resolveAuditActorId(this.base.actor),
      adjustedAt: adjustedAt ?? new Date(),
      status: this.deriveFeeStatus({
        expectedAmount: studentFee.expectedAmount.amount - adjustmentAmount,
        paidAmount: studentFee.paidAmount.amount,
        dueDate: studentFee.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.base.studentFees.save(adjusted, { moduleChecked: true })
    return adjusted
  }

  async cancelStudentFee({
    studentFeeId,
    reason,
    cancelledAt,
    updatedAt,
  }: CancelStudentFeeInput): Promise<StudentFee> {
    const studentFee = await this.requireStudentFee(studentFeeId)
    const student = await this.requireStudent(studentFee.studentId)
    this.checkActorSchool(student.schoolId)
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
    await this.base.authorizationPolicy.checkStudentFeeAccess(this.base.actor, [studentFee.id])
    if (studentFee.status === FeeStatus.Cancelled) {
      throw new BusinessRuleViolationError('ALREADY_CANCELLED_FEE', `Student fee ${studentFeeId} has already been cancelled`)
    }
    if (studentFee.paidAmount.amount > 0) {
      throw new BusinessRuleViolationError('CANCEL_PAID_FEE', `Student fee ${studentFeeId} cannot be cancelled while recorded payments remain`)
    }
    const cancelled = studentFee.copyWith({
      status: FeeStatus.Cancelled,
      cancellationReason: reason,
      cancelledById: resolveAuditActorId(this.base.actor),
      cancelledAt: cancelledAt ?? new Date(),
      updatedAt: updatedAt ?? new Date(),
    })
    await this.base.studentFees.save(cancelled, { moduleChecked: true })
    return cancelled
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
    await this.base.studentFees.save(studentFee.copyWith({
      paidAmount,
      status: this.deriveFeeStatus({
        expectedAmount: studentFee.expectedAmount.amount - studentFee.adjustmentAmount.amount,
        paidAmount,
        dueDate: studentFee.dueDate,
        referenceDate: referenceDate ?? new Date(),
      }),
      updatedAt: updatedAt ?? new Date(),
    }), { moduleChecked: true })
  }

  private deriveFeeStatus({
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

  private async requireFee(feeId: string): Promise<Fee> {
    const fee = await this.base.repositories.fees.findById(feeId)
    if (!fee || fee.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return fee
  }

  private async requireStudentFee(studentFeeId: string): Promise<StudentFee> {
    const studentFee = await this.base.repositories.studentFees.findById(studentFeeId)
    if (!studentFee) {
      denyResourceAccess()
    }
    const student = await this.base.repositories.students.findById(studentFee.studentId)
    if (!student || student.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return studentFee
  }

  private async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.base.repositories.payments.findById(paymentId)
    if (!payment) {
      denyResourceAccess()
    }
    const studentFee = await this.base.repositories.studentFees.findById(payment.studentFeeId)
    if (!studentFee) {
      denyResourceAccess()
    }
    const student = await this.base.repositories.students.findById(studentFee.studentId)
    if (!student || student.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return payment
  }
}
