import type { OperationRef } from '../../capabilities/authorization/operations/types'
import type { Fee, FeeInput, PaymentMethod, StudentFeeInstallment } from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import { operationModule } from '../../application/entities/entity-config'
import { denyResourceAccess, FinanceOperations, resolveAuditActorId } from '../../capabilities/authorization'
import { Fee as FeeEntity, FeeStatus, Payment, PaymentStatus, StudentFee } from '../../domain'
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

export type CreateFeeInput = FeeInput

export interface AdjustStudentFeeInput {
  studentFeeId: string
  adjustmentAmount: number
  reason?: string
}

export interface CancelStudentFeeInput {
  studentFeeId: string
  reason?: string
}

export class FinanceServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async createFee(input: CreateFeeInput): Promise<Fee> {
    const fee = new FeeEntity(input)
    await this.baseService.entities.fees.save(fee)
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
  }: AssignFeeToStudentInput): Promise<StudentFee> {
    const student = await this.requireStudent(studentId)
    this.checkActorSchool(student.schoolId)
    await this.authorizeFinance(FinanceOperations.paymentRecord)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
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
    await this.baseService.entities.studentFees.save(studentFee, { moduleChecked: true })
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
    return this.baseService.atomicExecution.execute(async () => {
      const studentFee = await this.requireStudentFee(studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      this.checkActorSchool(student.schoolId)
      await this.authorizeFinance(FinanceOperations.paymentRecord)
      await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
      await this.baseService.authorizationPolicy.checkStudentFeeAccess(this.baseService.actor, [studentFeeId])
      const payment = new Payment({
        id,
        studentFeeId,
        amount,
        currency: studentFee.expectedAmount.currency,
        paymentDate,
        method,
        reference,
        notes,
        recordedById: resolveAuditActorId(this.baseService.actor),
        createdAt,
      })
      await this.baseService.entities.payments.save(payment, { moduleChecked: true })
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
    return this.baseService.atomicExecution.execute(async () => {
      const payment = await this.requirePayment(paymentId)
      const studentFee = await this.requireStudentFee(payment.studentFeeId)
      const student = await this.requireStudent(studentFee.studentId)
      this.checkActorSchool(student.schoolId)
      await this.authorizeFinance(
        status === PaymentStatus.Cancelled ? FinanceOperations.paymentCancel : FinanceOperations.paymentReverse,
      )
      await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
      await this.baseService.authorizationPolicy.checkStudentFeeAccess(this.baseService.actor, [studentFee.id])
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
        reversedById: status === PaymentStatus.Reversed ? resolveAuditActorId(this.baseService.actor) : undefined,
        cancelledAt: status === PaymentStatus.Cancelled ? changedAt ?? new Date() : undefined,
        cancelledById: status === PaymentStatus.Cancelled ? resolveAuditActorId(this.baseService.actor) : undefined,
        createdAt: payment.createdAt,
      })
      await this.baseService.entities.payments.save(changedPayment, { moduleChecked: true })
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
  }: AdjustStudentFeeInput): Promise<StudentFee> {
    const existing = await this.requireStudentFee(studentFeeId)
    const adjusted = existing.copyWith({
      adjustmentAmount,
      adjustmentReason: reason,
      adjustedById: resolveAuditActorId(this.baseService.actor),
      adjustedAt: new Date(),
      updatedAt: new Date(),
    })
    await this.baseService.entities.studentFees.save(adjusted)
    return adjusted
  }

  async cancelStudentFee({ studentFeeId, reason }: CancelStudentFeeInput): Promise<StudentFee> {
    const existing = await this.requireStudentFee(studentFeeId)
    const cancelled = existing.copyWith({
      status: FeeStatus.Cancelled,
      cancellationReason: reason,
      cancelledById: resolveAuditActorId(this.baseService.actor),
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    await this.baseService.entities.studentFees.save(cancelled)
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

  private async authorizeFinance(operation: OperationRef): Promise<void> {
    await operationModule(operation)(this.baseService.actor)
  }

  private async savePaidAmount(
    studentFee: StudentFee,
    paidAmount: number,
    updatedAt?: Date,
    referenceDate?: Date,
  ): Promise<void> {
    await this.baseService.entities.studentFees.save(studentFee.copyWith({
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
    const fee = await this.baseService.repositories.fees.findById(feeId)
    if (!fee || fee.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return fee
  }

  private async requireStudentFee(studentFeeId: string): Promise<StudentFee> {
    const studentFee = await this.baseService.repositories.studentFees.findById(studentFeeId)
    if (!studentFee) {
      denyResourceAccess()
    }
    const student = await this.baseService.repositories.students.findById(studentFee.studentId)
    if (!student || student.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return studentFee
  }

  private async requirePayment(paymentId: string): Promise<Payment> {
    const payment = await this.baseService.repositories.payments.findById(paymentId)
    if (!payment) {
      denyResourceAccess()
    }
    const studentFee = await this.baseService.repositories.studentFees.findById(payment.studentFeeId)
    if (!studentFee) {
      denyResourceAccess()
    }
    const student = await this.baseService.repositories.students.findById(studentFee.studentId)
    if (!student || student.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return payment
  }
}
