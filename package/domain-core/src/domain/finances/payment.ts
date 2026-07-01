import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { AttachmentOwnerKind, FeeStatus } from '../../domain'
import { anyPermissionAction, config, dateTime, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'

export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  MobileMoney = 'mobile_money',
  Other = 'other',
}

export enum PaymentStatus {
  Recorded = 'recorded',
  Reversed = 'reversed',
  Cancelled = 'cancelled',
}

export const paymentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  studentFeeId: z.string().trim().min(1, 'studentFeeId must not be blank'),
  amount: z.number().int().nonnegative('amount must be a non-negative integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  paymentDate: zodDate(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.Recorded),
  reference: z.string().trim().min(1, 'reference must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedById: z.string().trim().min(1, 'recordedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  reversedById: z.string().trim().min(1, 'reversedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  cancelledById: z.string().trim().min(1, 'cancelledById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refinePayment(data: any, ctx: z.RefinementCtx) {
  if (data.status === PaymentStatus.Reversed && (!data.reversedAt || !data.reversedById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reversedAt and reversedById are required for reversed payments',
    })
  }
  if (data.status === PaymentStatus.Cancelled && (!data.cancelledAt || !data.cancelledById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancelledAt and cancelledById are required for cancelled payments',
    })
  }
  if (data.status === PaymentStatus.Recorded && (data.reversedAt || data.reversedById || data.cancelledAt || data.cancelledById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'recorded payments must not define reversal or cancellation audit fields',
    })
  }
}

export const paymentSchema = paymentBaseSchema.superRefine(refinePayment)

export type PaymentData = Omit<z.infer<typeof paymentSchema>, 'amount' | 'currency'> & {
  amount: Money
}
export type PaymentInput = z.input<typeof paymentSchema>

export const paymentCreateSchema = paymentBaseSchema.omit({ createdAt: true }).superRefine(refinePayment)
export const paymentUpdateSchema = paymentBaseSchema.partial().required({ id: true }).superRefine(refinePayment)

/**
 * Represents a single financial transaction made towards a StudentFee.
 */
export class Payment {
  readonly data: PaymentData

  constructor(args: PaymentInput) {
    const validated = parseDomain(paymentSchema, args)
    this.data = {
      id: validated.id,
      studentFeeId: validated.studentFeeId,
      amount: new Money({ amount: validated.amount, currency: validated.currency }),
      paymentDate: validated.paymentDate,
      method: validated.method,
      status: validated.status,
      reference: validated.reference,
      notes: validated.notes,
      recordedById: validated.recordedById,
      reversedAt: validated.reversedAt,
      reversedById: validated.reversedById,
      cancelledAt: validated.cancelledAt,
      cancelledById: validated.cancelledById,
      createdAt: validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get studentFeeId() { return this.data.studentFeeId }
  get amount() { return this.data.amount }
  get paymentDate() { return this.data.paymentDate }
  get method() { return this.data.method }
  get status() { return this.data.status }
  get reference() { return this.data.reference }
  get notes() { return this.data.notes }
  get recordedById() { return this.data.recordedById }
  get reversedAt() { return this.data.reversedAt }
  get reversedById() { return this.data.reversedById }
  get cancelledAt() { return this.data.cancelledAt }
  get cancelledById() { return this.data.cancelledById }
  get createdAt() { return this.data.createdAt }
}

export const paymentConfig: EntityConfigFactory<Payment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.payments,
    tenant: paymentTenant(),
    read: read(permissionAction(Permission.PAYMENT_READ), noopReadAccess),
    write: write(
      anyPermissionAction([Permission.PAYMENT_RECORD, Permission.PAYMENT_CANCEL, Permission.PAYMENT_REVERSE]),
      authorizePayment(policy),
      authorizePaymentDelete(policy),
    ),
    gates: {
      preSave: validatePaymentSave,
      preDelete: validatePaymentDelete,
    },
    atomicExecution,
  })

function paymentTenant(): EntityTenantResolver<Payment> {
  return indirectTenant(async (entity, repositories) => {
    const studentFee = await repositories.studentFees.findById(entity.studentFeeId)
    if (!studentFee)
      return undefined
    const student = await repositories.students.findById(studentFee.studentId)
    return student?.schoolId
  })
}

export async function validatePaymentSave(
  payment: Payment,
  existing: Payment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const studentFee = await repositories.studentFees.findById(payment.studentFeeId)
  if (!studentFee) {
    denyResourceAccess()
  }
  if (!existing && studentFee.status === FeeStatus.Cancelled) {
    throw new BusinessRuleViolationError('CANCELLED_FEE_PAYMENT', `Student fee ${payment.studentFeeId} cannot receive payments after cancellation`)
  }
  if (!existing) {
    return
  }
  if (existing.studentFeeId !== payment.studentFeeId) {
    denyResourceAccess()
  }
  if (existing.status !== PaymentStatus.Recorded && paymentStatusChanged(payment, existing)) {
    const code = payment.status === PaymentStatus.Reversed ? 'INVALID_PAYMENT_REVERSAL' : 'INVALID_PAYMENT_CANCELLATION'
    throw new BusinessRuleViolationError(code, `Payment ${payment.id} cannot be ${payment.status} from status ${existing.status}`)
  }
  if (existing.status === PaymentStatus.Recorded && payment.status === PaymentStatus.Recorded) {
    return
  }
  if (existing.status === PaymentStatus.Recorded && payment.status === PaymentStatus.Reversed) {
    return
  }
  if (existing.status === PaymentStatus.Recorded && payment.status === PaymentStatus.Cancelled) {
    return
  }
  const code = payment.status === PaymentStatus.Reversed ? 'INVALID_PAYMENT_REVERSAL' : 'INVALID_PAYMENT_CANCELLATION'
  throw new BusinessRuleViolationError(code, `Payment ${payment.id} cannot be ${payment.status} from status ${existing.status}`)
}

function paymentStatusChanged(entity: Payment, existing: Payment): boolean {
  return entity.status !== existing.status
    || dateTime(entity.reversedAt) !== dateTime(existing.reversedAt)
    || entity.reversedById !== existing.reversedById
    || dateTime(entity.cancelledAt) !== dateTime(existing.cancelledAt)
    || entity.cancelledById !== existing.cancelledById
}

export function authorizePayment(policy: AuthorizationPolicy): EntityWriteAuthorization<Payment>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await permissionAction(paymentWritePermission(entity, existing))(actor)
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

export function authorizePaymentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<Payment>['authorizeDelete'] {
  return async (actor, entity) => {
    await permissionAction(Permission.PAYMENT_CANCEL)(actor)
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

function paymentWritePermission(entity: Payment, existing: Payment | undefined): Permission {
  if (entity.status === PaymentStatus.Cancelled && existing?.status !== PaymentStatus.Cancelled) {
    return Permission.PAYMENT_CANCEL
  }
  if (entity.status === PaymentStatus.Reversed && existing?.status !== PaymentStatus.Reversed) {
    return Permission.PAYMENT_REVERSE
  }
  return Permission.PAYMENT_RECORD
}

async function validatePaymentDelete(
  payment: Payment,
  repositories: SchoolRepositories,
): Promise<void> {
  const attachments = await repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Payment, ownerId: payment.id })
  if (attachments.length > 0 || payment.status !== PaymentStatus.Recorded) {
    throw new BusinessRuleViolationError('PAYMENT_DELETE_BLOCKED', `Cannot delete payment ${payment.id}: dependent records exist or payment is no longer recorded`)
  }
}
