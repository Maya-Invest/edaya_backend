import type { AuthorizationPolicy } from '../../../authorization'
import type { Payment } from '../../../entities/finances/payment'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess, Permission } from '../../../authorization'
import { FeeStatus } from '../../../entities'
import { PaymentStatus } from '../../../entities/finances/payment'
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { anyPermissionAction, config, dateTime, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

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
