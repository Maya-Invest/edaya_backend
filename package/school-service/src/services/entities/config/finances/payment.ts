import type { AuthorizationPolicy, OperationRef } from '@edaya/authorization'
import type { CoreEntityRepositories, Payment } from '@edaya/core'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, FinanceOperations } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError, FeeStatus, PaymentStatus } from '@edaya/core'
import { anyOperationModule, authorizeDeleteWithOperation, authorizeSaveWithOperation, config, operationModule, read, write } from '../../entity-config'
import { dateTime, unique } from '../../entity-config/helper-utils'

import { indirectTenant } from '../../entity-config/tenant'
// Extracted from domain/finances/payment.ts (PR3)
export const paymentConfig: EntityConfigFactory<Payment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.payments,
    tenant: paymentTenant(),
    read: read(
      operationModule(FinanceOperations.paymentsRead),
      async (actor, entities) => {
        const studentFeeIds = unique(entities.map(entity => entity.studentFeeId))
        await policy.checkStudentFeeAccess(actor, studentFeeIds)
      },
    ),
    write: write(
      anyOperationModule([
        FinanceOperations.paymentRecord,
        FinanceOperations.paymentCancel,
        FinanceOperations.paymentReverse,
      ]),
      authorizeSaveWithOperation(
        resolvePaymentWriteOperation,
        resolvePaymentContext,
        authorizePaymentResource(policy),
      ),
      authorizeDeleteWithOperation(
        FinanceOperations.paymentCancel,
        (entity, repositories) => resolvePaymentContext(entity, undefined, repositories),
        authorizePaymentDeleteResource(policy),
      ),
    ),
    gates: {
      preSave: validatePaymentSave,
      preDelete: validatePaymentDelete,
    },
    atomicExecution,
  })

async function resolvePaymentContext(
  entity: Payment,
  _existing: Payment | undefined,
  repositories: CoreEntityRepositories,
) {
  const studentFee = await repositories.studentFees.findById(entity.studentFeeId)
  if (!studentFee) {
    denyResourceAccess()
  }
  return { studentId: studentFee.studentId }
}

function resolvePaymentWriteOperation(
  entity: Payment,
  existing: Payment | undefined,
): OperationRef {
  if (entity.status === PaymentStatus.Cancelled && existing?.status !== PaymentStatus.Cancelled) {
    return FinanceOperations.paymentCancel
  }
  if (entity.status === PaymentStatus.Reversed && existing?.status !== PaymentStatus.Reversed) {
    return FinanceOperations.paymentReverse
  }
  return FinanceOperations.paymentRecord
}

function authorizePaymentResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<Payment>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

function authorizePaymentDeleteResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<Payment>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

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
  repositories: CoreEntityRepositories,
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

export async function validatePaymentDelete(
  payment: Payment,
  repositories: CoreEntityRepositories,
): Promise<void> {
  const attachments = await repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Payment, ownerId: payment.id })
  if (attachments.length > 0 || payment.status !== PaymentStatus.Recorded) {
    throw new BusinessRuleViolationError('PAYMENT_DELETE_BLOCKED', `Cannot delete payment ${payment.id}: dependent records exist or payment is no longer recorded`)
  }
}
