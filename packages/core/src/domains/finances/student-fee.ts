import type { AuthorizationPolicy } from '../../authorization/authorization-policy'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { anyPermissionAction, config, dateTime, indirectTenant, permissionAction, read, readByIds, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { Money } from '../../value_object/money'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

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

export const studentFeeInstallmentSchema = z.object({
  id: z.string().trim().min(1, 'installment.id must not be blank'),
  label: z.string().trim().min(1, 'installment.label must not be blank'),
  expectedAmount: z.number().int().nonnegative('installment.expectedAmount must be a non-negative integer'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export const studentFeeBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  feeId: z.string().trim().min(1, 'feeId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  expectedAmount: z.number().int().nonnegative('expectedAmount must be a non-negative integer'),
  paidAmount: z.number().int().nonnegative('paidAmount must be a non-negative integer').default(0),
  adjustmentAmount: z.number().int().nonnegative('adjustmentAmount must be a non-negative integer').default(0),
  adjustmentReason: z.string().trim().min(1, 'adjustmentReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  adjustedById: z.string().trim().min(1, 'adjustedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  adjustedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  dueDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(FeeStatus),
  cancellationReason: z.string().trim().min(1, 'cancellationReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledById: z.string().trim().min(1, 'cancelledById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  installments: z.array(studentFeeInstallmentSchema).default([]),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineStudentFee(data: any, ctx: z.RefinementCtx) {
  if (data.adjustmentAmount > data.expectedAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'adjustmentAmount must not exceed expectedAmount',
    })
  }
  if (data.adjustmentAmount > 0 && (!data.adjustmentReason || !data.adjustedById || !data.adjustedAt)) {
    if (!data.adjustmentReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adjustmentReason'],
        message: 'adjustmentReason must not be blank',
      })
    }
    if (!data.adjustedById || !data.adjustedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'adjustedById and adjustedAt are required for adjusted student fees',
      })
    }
  }
  if (data.adjustmentAmount === 0 && (data.adjustedById || data.adjustedAt || data.adjustmentReason)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'unadjusted student fees must not define adjustment audit fields',
    })
  }
  if (data.installments && data.installments.length > 0) {
    const totalExpected = data.installments.reduce((sum: number, inst: any) => sum + inst.expectedAmount, 0)
    if (totalExpected !== data.expectedAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'installment expected amounts must total expectedAmount',
      })
    }
  }
  if (data.status === FeeStatus.Overdue && !data.dueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'overdue fees must define a dueDate',
    })
  }
  if (data.status === FeeStatus.Cancelled && (!data.cancellationReason || !data.cancelledById || !data.cancelledAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancellation reason, actor, and date are required for cancelled student fees',
    })
  }
  if (data.status !== FeeStatus.Cancelled && (data.cancellationReason || data.cancelledById || data.cancelledAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'active student fees must not define cancellation audit fields',
    })
  }
}

export const studentFeeSchema = studentFeeBaseSchema.superRefine(refineStudentFee)

export type StudentFeeData = Omit<z.infer<typeof studentFeeSchema>, 'expectedAmount' | 'paidAmount' | 'adjustmentAmount' | 'currency' | 'installments'> & {
  expectedAmount: Money
  paidAmount: Money
  adjustmentAmount: Money
  installments: readonly StudentFeeInstallment[]
}

export const studentFeeCreateSchema = studentFeeBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineStudentFee)
export const studentFeeUpdateSchema = studentFeeBaseSchema.partial().required({ id: true }).superRefine(refineStudentFee)

export interface StudentFeeArgs {
  id: string
  studentId: string
  feeId: string
  academicYearId: string
  expectedAmount: number
  paidAmount?: number | null
  adjustmentAmount?: number | null
  adjustmentReason?: string | null
  adjustedById?: string | null
  adjustedAt?: Date | null
  currency: string
  dueDate?: Date | null
  status: FeeStatus
  cancellationReason?: string | null
  cancelledById?: string | null
  cancelledAt?: Date | null
  installments?: readonly StudentFeeInstallment[]
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
  readonly data: StudentFeeData

  constructor(args: StudentFeeArgs) {
    const result = studentFeeSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    const validated = result.data
    const activeCurrency = validated.currency
    this.data = {
      id: validated.id,
      studentId: validated.studentId,
      feeId: validated.feeId,
      academicYearId: validated.academicYearId,
      expectedAmount: new Money({ amount: validated.expectedAmount, currency: activeCurrency }),
      paidAmount: new Money({ amount: validated.paidAmount, currency: activeCurrency }),
      adjustmentAmount: new Money({ amount: validated.adjustmentAmount, currency: activeCurrency }),
      adjustmentReason: validated.adjustmentReason,
      adjustedById: validated.adjustedById,
      adjustedAt: validated.adjustedAt,
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
  get studentId() { return this.data.studentId }
  get feeId() { return this.data.feeId }
  get academicYearId() { return this.data.academicYearId }
  get expectedAmount() { return this.data.expectedAmount }
  get paidAmount() { return this.data.paidAmount }
  get adjustmentAmount() { return this.data.adjustmentAmount }
  get adjustmentReason() { return this.data.adjustmentReason }
  get adjustedById() { return this.data.adjustedById }
  get adjustedAt() { return this.data.adjustedAt }
  get dueDate() { return this.data.dueDate }
  get status() { return this.data.status }
  get cancellationReason() { return this.data.cancellationReason }
  get cancelledById() { return this.data.cancelledById }
  get cancelledAt() { return this.data.cancelledAt }
  get installments() { return this.data.installments }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get balanceDue(): Money {
    return new Money({
      amount: this.status === FeeStatus.Cancelled
        ? 0
        : Math.max(0, this.expectedAmount.amount - this.adjustmentAmount.amount - this.paidAmount.amount),
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
      adjustmentAmount: changes.adjustmentAmount ?? this.adjustmentAmount.amount,
      adjustmentReason: changes.adjustmentReason !== undefined ? changes.adjustmentReason : this.adjustmentReason,
      adjustedById: changes.adjustedById !== undefined ? changes.adjustedById : this.adjustedById,
      adjustedAt: changes.adjustedAt !== undefined ? changes.adjustedAt : this.adjustedAt,
      currency: this.expectedAmount.currency,
      dueDate: changes.dueDate !== undefined ? changes.dueDate : this.dueDate,
      status: changes.status ?? this.status,
      cancellationReason: changes.cancellationReason !== undefined ? changes.cancellationReason : this.cancellationReason,
      cancelledById: changes.cancelledById !== undefined ? changes.cancelledById : this.cancelledById,
      cancelledAt: changes.cancelledAt !== undefined ? changes.cancelledAt : this.cancelledAt,
      installments: this.installments,
      createdAt: this.createdAt,
      updatedAt: changes.updatedAt !== undefined ? changes.updatedAt : this.updatedAt,
    })
  }
}

export class StudentFeeSummary {
  readonly totalExpected: Money
  readonly totalPaid: Money
  readonly totalOverdue: Money
  readonly totalAdjusted: Money
  readonly balanceDue: Money
  readonly itemCount: number

  constructor(args: {
    totalExpected: Money
    totalPaid: Money
    totalOverdue: Money
    totalAdjusted?: Money
    itemCount: number
  }) {
    this.totalExpected = args.totalExpected
    this.totalPaid = args.totalPaid
    this.totalOverdue = args.totalOverdue
    this.totalAdjusted = args.totalAdjusted ?? new Money({
      amount: 0,
      currency: args.totalExpected.currency,
    })
    this.balanceDue = new Money({
      amount: Math.max(0, args.totalExpected.amount - this.totalAdjusted.amount - args.totalPaid.amount),
      currency: args.totalExpected.currency,
    })
    this.itemCount = args.itemCount
  }
}

export function buildStudentFeeSummary(studentFees: readonly StudentFee[], fallbackCurrency = 'XAF'): StudentFeeSummary {
  const currency = studentFees[0]?.expectedAmount.currency ?? fallbackCurrency
  const activeFees = studentFees.filter(item => item.status !== FeeStatus.Cancelled)
  const totalExpectedAmount = activeFees.reduce((sum, item) => sum + item.expectedAmount.amount, 0)
  const totalPaidAmount = activeFees.reduce((sum, item) => sum + item.paidAmount.amount, 0)
  const totalOverdueAmount = activeFees
    .filter(item => item.status === FeeStatus.Overdue)
    .reduce((sum, item) => sum + item.balanceDue.amount, 0)
  const totalAdjustedAmount = activeFees.reduce((sum, item) => sum + item.adjustmentAmount.amount, 0)
  return new StudentFeeSummary({
    totalExpected: new Money({ amount: totalExpectedAmount, currency }),
    totalPaid: new Money({ amount: totalPaidAmount, currency }),
    totalAdjusted: new Money({ amount: totalAdjustedAmount, currency }),
    totalOverdue: new Money({ amount: totalOverdueAmount, currency }),
    itemCount: studentFees.length,
  })
}

export const studentFeeConfig: EntityConfigFactory<StudentFee> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentFees,
    tenant: studentFeeTenant(),
    read: read(permissionAction(policy, Permission.PAYMENT_READ), readByIds((actor, ids) => policy.checkStudentFeeAccess(actor, ids))),
    write: write(
      anyPermissionAction(policy, [Permission.PAYMENT_RECORD, Permission.PAYMENT_CANCEL]),
      authorizeStudentFee(policy),
      authorizeStudentFeeDelete(policy),
    ),
    gates: {
      preSave: validateStudentFeeSave,
      preDelete: validateStudentFeeDelete,
    },
    atomicExecution,
  })

function studentFeeTenant(): EntityTenantResolver<StudentFee> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

export async function validateStudentFeeSave(
  entity: StudentFee,
  existing: StudentFee | undefined,
): Promise<void> {
  if (!existing)
    return

  if (
    existing.status === FeeStatus.Cancelled
    && entity.status === FeeStatus.Cancelled
    && cancellationChanged(entity, existing)
  ) {
    throw new BusinessRuleViolationError('ALREADY_CANCELLED_FEE', `Student fee ${existing.id} has already been cancelled`)
  }
  if (existing.status !== FeeStatus.Cancelled && entity.status === FeeStatus.Cancelled && existing.paidAmount.amount > 0) {
    throw new BusinessRuleViolationError('CANCEL_PAID_FEE', `Student fee ${existing.id} cannot be cancelled while recorded payments remain`)
  }

  const adjustmentChanged = entity.adjustmentAmount.amount !== existing.adjustmentAmount.amount
    || entity.adjustmentReason !== existing.adjustmentReason
    || entity.adjustedById !== existing.adjustedById
    || dateTime(entity.adjustedAt) !== dateTime(existing.adjustedAt)
  if (!adjustmentChanged)
    return

  if (existing.status === FeeStatus.Cancelled) {
    throw new BusinessRuleViolationError('CANCELLED_FEE_ADJUSTMENT', `Student fee ${existing.id} cannot be adjusted after cancellation`)
  }
  if (existing.adjustmentAmount.amount > 0) {
    throw new BusinessRuleViolationError('ALREADY_ADJUSTED_FEE', `Student fee ${existing.id} has already been adjusted`)
  }
  if (entity.adjustmentAmount.amount <= 0) {
    throw new BusinessRuleViolationError('INVALID_ADJUSTMENT_AMOUNT', 'adjustmentAmount must be strictly positive')
  }
  if (entity.adjustmentAmount.amount > entity.expectedAmount.amount - entity.paidAmount.amount) {
    throw new BusinessRuleViolationError('ADJUSTMENT_EXCEEDS_OUTSTANDING', 'adjustmentAmount must not reduce a fee below its paid amount')
  }
}

function cancellationChanged(entity: StudentFee, existing: StudentFee): boolean {
  return entity.cancellationReason !== existing.cancellationReason
    || entity.cancelledById !== existing.cancelledById
    || dateTime(entity.cancelledAt) !== dateTime(existing.cancelledAt)
}

export function authorizeStudentFee(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentFee>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await permissionAction(policy, studentFeeWritePermission(entity, existing))(actor)
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

export function authorizeStudentFeeDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentFee>['authorizeDelete'] {
  return async (actor, entity) => {
    await permissionAction(policy, Permission.PAYMENT_CANCEL)(actor)
    await policy.checkStudentFeeAccess(actor, [entity.id])
  }
}

function studentFeeWritePermission(entity: StudentFee, existing: StudentFee | undefined): Permission {
  if (existing?.status !== FeeStatus.Cancelled && entity.status === FeeStatus.Cancelled) {
    return Permission.PAYMENT_CANCEL
  }
  return Permission.PAYMENT_RECORD
}

async function validateStudentFeeDelete(
  studentFee: StudentFee,
  repositories: SchoolRepositories,
): Promise<void> {
  const payments = await repositories.payments.list({ studentFeeId: studentFee.id })
  if (payments.length > 0) {
    throw new BusinessRuleViolationError('STUDENT_FEE_HAS_DEPENDENCIES', `Cannot delete student fee ${studentFee.id}: dependent records still exist`)
  }
}
