import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { AttachmentOwnerKind, FeeStatus } from '../../domains'
import { anyPermissionAction, config, dateTime, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { Money } from '../../value_object/money'
import { requireNonBlank, requireNonNegativeInt, requireOptionalNonBlank, requireValidDate } from '../utils'

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

export interface PaymentArgs {
  id: string
  studentFeeId: string
  amount: number
  currency: string
  paymentDate: Date
  method: PaymentMethod
  status?: PaymentStatus
  reference?: string | null
  notes?: string | null
  recordedById?: string | null
  reversedAt?: Date | null
  reversedById?: string | null
  cancelledAt?: Date | null
  cancelledById?: string | null
  createdAt?: Date
}

/**
 * Represents a single financial transaction made towards a StudentFee.
 */
export class Payment {
  readonly id: string
  readonly studentFeeId: string
  readonly amount: Money
  readonly paymentDate: Date
  readonly method: PaymentMethod
  readonly status: PaymentStatus
  readonly reference?: string
  readonly notes?: string
  readonly recordedById?: string
  readonly reversedAt?: Date
  readonly reversedById?: string
  readonly cancelledAt?: Date
  readonly cancelledById?: string
  readonly createdAt: Date

  constructor({
    id,
    studentFeeId,
    amount,
    currency,
    paymentDate,
    method,
    status = PaymentStatus.Recorded,
    reference,
    notes,
    recordedById,
    reversedAt,
    reversedById,
    cancelledAt,
    cancelledById,
    createdAt,
  }: PaymentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentFeeId = requireNonBlank(studentFeeId, 'studentFeeId')

    this.amount = new Money({
      amount: requireNonNegativeInt(amount, 'amount'),
      currency: requireNonBlank(currency, 'currency'),
    })

    this.paymentDate = requireValidDate(paymentDate, 'paymentDate')
    this.method = method
    this.status = status
    this.reference = requireOptionalNonBlank(reference, 'reference')
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.recordedById = requireOptionalNonBlank(recordedById, 'recordedById')
    this.reversedAt = reversedAt ? requireValidDate(reversedAt, 'reversedAt') : undefined
    this.reversedById = requireOptionalNonBlank(reversedById, 'reversedById')
    this.cancelledAt = cancelledAt ? requireValidDate(cancelledAt, 'cancelledAt') : undefined
    this.cancelledById = requireOptionalNonBlank(cancelledById, 'cancelledById')
    this.createdAt = createdAt ?? new Date()

    if (this.status === PaymentStatus.Reversed && (!this.reversedAt || !this.reversedById)) {
      throw new Error('reversedAt and reversedById are required for reversed payments')
    }
    if (this.status === PaymentStatus.Cancelled && (!this.cancelledAt || !this.cancelledById)) {
      throw new Error('cancelledAt and cancelledById are required for cancelled payments')
    }
    if (this.status === PaymentStatus.Recorded && (this.reversedAt || this.reversedById || this.cancelledAt || this.cancelledById)) {
      throw new Error('recorded payments must not define reversal or cancellation audit fields')
    }
  }
}

export const paymentConfig: EntityConfigFactory<Payment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.payments,
    tenant: paymentTenant(),
    read: read(permissionAction(policy, Permission.PAYMENT_READ), noopReadAccess),
    write: write(
      anyPermissionAction(policy, [Permission.PAYMENT_RECORD, Permission.PAYMENT_CANCEL, Permission.PAYMENT_REVERSE]),
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
    await permissionAction(policy, paymentWritePermission(entity, existing))(actor)
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

export function authorizePaymentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<Payment>['authorizeDelete'] {
  return async (actor, entity) => {
    await permissionAction(policy, Permission.PAYMENT_CANCEL)(actor)
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
