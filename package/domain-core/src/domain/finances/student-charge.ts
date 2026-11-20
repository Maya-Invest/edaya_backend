import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'

export enum ChargeStatus {
  Pending = 'pending',
  Partial = 'partial',
  Paid = 'paid',
  Overdue = 'overdue',
  Cancelled = 'cancelled',
  Waived = 'waived',
}

export const chargeInstallmentSchema = z.object({
  id: z.string().trim().min(1, 'installment.id must not be blank'),
  label: z.string().trim().min(1, 'installment.label must not be blank'),
  expectedAmount: z.number().int().nonnegative('installment.expectedAmount must be a non-negative integer'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})
export type ChargeInstallment = z.infer<typeof chargeInstallmentSchema>

export const studentChargeBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  enrollmentId: z.string().trim().min(1, 'enrollmentId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  label: z.string().trim().min(1, 'label must not be blank'),
  expectedAmount: z.number().int().nonnegative('expectedAmount must be a non-negative integer'),
  allocatedAmount: z.number().int().nonnegative('allocatedAmount must be a non-negative integer').default(0),
  adjustmentAmount: z.number().int().nonnegative('adjustmentAmount must be a non-negative integer').default(0),
  adjustmentReason: z.string().trim().min(1, 'adjustmentReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  adjustedById: z.string().trim().min(1, 'adjustedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  adjustedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  waiverAmount: z.number().int().nonnegative('waiverAmount must be a non-negative integer').default(0),
  waiverReason: z.string().trim().min(1, 'waiverReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  waivedById: z.string().trim().min(1, 'waivedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  waivedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(ChargeStatus),
  cancellationReason: z.string().trim().min(1, 'cancellationReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledById: z.string().trim().min(1, 'cancelledById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  installments: z.array(chargeInstallmentSchema).default([]),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineCharge(data: any, ctx: z.RefinementCtx) {
  if (data.adjustmentAmount + data.waiverAmount > data.expectedAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'adjustmentAmount plus waiverAmount must not exceed expectedAmount',
    })
  }
  if (data.allocatedAmount > data.expectedAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'allocatedAmount must not exceed expectedAmount',
    })
  }
  if (data.adjustmentAmount > 0 && (!data.adjustmentReason || !data.adjustedById || !data.adjustedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'adjustedById, adjustedAt, and adjustmentReason are required for adjusted charges',
    })
  }
  if (data.adjustmentAmount === 0 && (data.adjustedById || data.adjustedAt || data.adjustmentReason)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unadjusted charges must not define adjustment audit fields',
    })
  }
  if (data.waiverAmount > 0 && (!data.waiverReason || !data.waivedById || !data.waivedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'waivedById, waivedAt, and waiverReason are required for waived charges',
    })
  }
  if (data.waiverAmount === 0 && (data.waivedById || data.waivedAt || data.waiverReason)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unwaived charges must not define waiver audit fields',
    })
  }
  if (data.installments.length > 0) {
    const totalExpected = data.installments.reduce((sum: number, inst: { expectedAmount: number }) => sum + inst.expectedAmount, 0)
    if (totalExpected !== data.expectedAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installment expected amounts must total expectedAmount',
      })
    }
  }
  if (data.status === ChargeStatus.Cancelled && (!data.cancellationReason || !data.cancelledById || !data.cancelledAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancellation reason, actor, and date are required for cancelled charges',
    })
  }
  if (data.status !== ChargeStatus.Cancelled && (data.cancellationReason || data.cancelledById || data.cancelledAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'active charges must not define cancellation audit fields',
    })
  }
}

export const studentChargeSchema = studentChargeBaseSchema.superRefine(refineCharge)

export type StudentChargeData = Omit<z.infer<typeof studentChargeSchema>, 'expectedAmount' | 'allocatedAmount' | 'adjustmentAmount' | 'waiverAmount' | 'currency' | 'installments'> & {
  expectedAmount: Money
  allocatedAmount: Money
  adjustmentAmount: Money
  waiverAmount: Money
  installments: readonly ChargeInstallment[]
}
export type StudentChargeInput = z.input<typeof studentChargeSchema>

export const studentChargeCreateSchema = studentChargeBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineCharge)
export const studentChargeUpdateSchema = studentChargeBaseSchema.partial().required({ id: true })

export class StudentCharge {
  readonly data: StudentChargeData

  constructor(args: StudentChargeInput) {
    const validated = parseDomain(studentChargeSchema, args)
    const currency = validated.currency
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      studentId: validated.studentId,
      enrollmentId: validated.enrollmentId,
      academicYearId: validated.academicYearId,
      label: validated.label,
      expectedAmount: new Money({ amount: validated.expectedAmount, currency }),
      allocatedAmount: new Money({ amount: validated.allocatedAmount, currency }),
      adjustmentAmount: new Money({ amount: validated.adjustmentAmount, currency }),
      adjustmentReason: validated.adjustmentReason,
      adjustedById: validated.adjustedById,
      adjustedAt: validated.adjustedAt,
      waiverAmount: new Money({ amount: validated.waiverAmount, currency }),
      waiverReason: validated.waiverReason,
      waivedById: validated.waivedById,
      waivedAt: validated.waivedAt,
      dueDate: validated.dueDate,
      status: validated.status,
      cancellationReason: validated.cancellationReason,
      cancelledById: validated.cancelledById,
      cancelledAt: validated.cancelledAt,
      installments: Object.freeze(validated.installments),
      createdAt: validated.createdAt,
      updatedAt: validated.updatedAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get enrollmentId() { return this.data.enrollmentId }
  get academicYearId() { return this.data.academicYearId }
  get label() { return this.data.label }
  get expectedAmount() { return this.data.expectedAmount }
  get allocatedAmount() { return this.data.allocatedAmount }
  get adjustmentAmount() { return this.data.adjustmentAmount }
  get adjustmentReason() { return this.data.adjustmentReason }
  get adjustedById() { return this.data.adjustedById }
  get adjustedAt() { return this.data.adjustedAt }
  get waiverAmount() { return this.data.waiverAmount }
  get waiverReason() { return this.data.waiverReason }
  get waivedById() { return this.data.waivedById }
  get waivedAt() { return this.data.waivedAt }
  get dueDate() { return this.data.dueDate }
  get status() { return this.data.status }
  get cancellationReason() { return this.data.cancellationReason }
  get cancelledById() { return this.data.cancelledById }
  get cancelledAt() { return this.data.cancelledAt }
  get installments() { return this.data.installments }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get currency() {
    return this.expectedAmount.currency
  }

  get netObligation(): Money {
    return new Money({
      amount: Math.max(0, this.expectedAmount.amount - this.adjustmentAmount.amount - this.waiverAmount.amount),
      currency: this.currency,
    })
  }

  get remainingObligation(): Money {
    if (this.status === ChargeStatus.Cancelled) {
      return new Money({ amount: 0, currency: this.currency })
    }
    return new Money({
      amount: Math.max(0, this.netObligation.amount - this.allocatedAmount.amount),
      currency: this.currency,
    })
  }

  copyWith(changes: Partial<StudentChargeInput>): StudentCharge {
    return new StudentCharge({
      id: this.id,
      schoolId: this.schoolId,
      studentId: this.studentId,
      enrollmentId: this.enrollmentId,
      academicYearId: this.academicYearId,
      label: this.label,
      expectedAmount: this.expectedAmount.amount,
      allocatedAmount: this.allocatedAmount.amount,
      adjustmentAmount: this.adjustmentAmount.amount,
      adjustmentReason: this.adjustmentReason,
      adjustedById: this.adjustedById,
      adjustedAt: this.adjustedAt,
      waiverAmount: this.waiverAmount.amount,
      waiverReason: this.waiverReason,
      waivedById: this.waivedById,
      waivedAt: this.waivedAt,
      currency: this.currency,
      dueDate: this.dueDate,
      status: this.status,
      cancellationReason: this.cancellationReason,
      cancelledById: this.cancelledById,
      cancelledAt: this.cancelledAt,
      installments: [...this.installments],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}
