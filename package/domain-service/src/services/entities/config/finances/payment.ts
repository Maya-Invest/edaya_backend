import type { CoreEntityRepositories, Payment } from '@edaya/core'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError, PaymentKind, PaymentStatus } from '@edaya/core'
import { config } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

export const paymentConfig: EntityConfigFactory<Payment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.payments,
    tenant: paymentTenant(),
    resource: 'payments',
    gates: {
      preSave: validatePaymentSave,
      preDelete: validatePaymentDelete,
    },
    atomicExecution,
  })

function paymentTenant(): EntityTenantResolver<Payment> {
  return indirectTenant(async entity => entity.schoolId)
}

export async function validatePaymentSave(
  payment: Payment,
  existing: Payment | undefined,
  repositories: CoreEntityRepositories,
): Promise<void> {
  const account = await repositories.studentYearAccounts.findById(payment.accountId)
  if (!account || account.schoolId !== payment.schoolId) {
    denyResourceAccess()
  }
  if (account.currency !== payment.amount.currency || account.academicYearId !== payment.academicYearId) {
    throw new BusinessRuleViolationError('CURRENCY_MISMATCH', 'Payment year and currency must match the student year account')
  }
  if (!existing) {
    return
  }
  if (existing.accountId !== payment.accountId || existing.amount.amount !== payment.amount.amount || existing.kind !== payment.kind) {
    denyResourceAccess()
  }
  if (existing.status !== PaymentStatus.Recorded && paymentStatusChanged(payment, existing)) {
    throw new BusinessRuleViolationError('INVALID_PAYMENT_REVERSAL', `Payment ${payment.id} cannot be ${payment.status} from status ${existing.status}`)
  }
  if (existing.status === PaymentStatus.Recorded && payment.status === PaymentStatus.Recorded) {
    return
  }
  if (existing.status === PaymentStatus.Recorded && payment.status === PaymentStatus.Reversed) {
    if (existing.kind !== PaymentKind.Receipt) {
      throw new BusinessRuleViolationError('INVALID_PAYMENT_REVERSAL', `Payment ${payment.id} is not a recorded receipt`)
    }
    return
  }
  throw new BusinessRuleViolationError('INVALID_PAYMENT_REVERSAL', `Payment ${payment.id} cannot be ${payment.status} from status ${existing.status}`)
}

function paymentStatusChanged(entity: Payment, existing: Payment): boolean {
  return entity.status !== existing.status
    || dateTime(entity.reversedAt) !== dateTime(existing.reversedAt)
    || entity.reversedById !== existing.reversedById
    || entity.reversedByPaymentId !== existing.reversedByPaymentId
}

export async function validatePaymentDelete(
  payment: Payment,
  repositories: CoreEntityRepositories,
): Promise<void> {
  const attachments = await repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Payment, ownerId: payment.id })
  if (attachments.length > 0 || payment.status !== PaymentStatus.Recorded) {
    throw new BusinessRuleViolationError('PAYMENT_DELETE_BLOCKED', `Cannot delete payment ${payment.id}: dependent records exist or payment is no longer recorded`)
  }
}
