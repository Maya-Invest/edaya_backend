import type { AuthorizationPolicy, OperationRef } from '@edaya/authorization'
import type { StudentFee } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { FinanceOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, FeeStatus } from '@edaya/core'
import { anyOperationModule, authorizeDeleteWithOperation, authorizeSaveWithOperation, config, operationModule, read, readByIds, write } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/finances/student-fee.ts (PR3)
export const studentFeeConfig: EntityConfigFactory<StudentFee> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentFees,
    tenant: studentFeeTenant(),
    read: read(
      operationModule(FinanceOperations.paymentsRead),
      readByIds((actor, ids) => policy.checkStudentFeeAccess(actor, ids)),
    ),
    write: write(
      anyOperationModule([FinanceOperations.paymentRecord, FinanceOperations.paymentCancel]),
      authorizeSaveWithOperation(
        resolveStudentFeeWriteOperation,
        async entity => ({ studentId: entity.studentId }),
        authorizeStudentFeeResource(policy),
      ),
      authorizeDeleteWithOperation(
        FinanceOperations.paymentCancel,
        async entity => ({ studentId: entity.studentId }),
        authorizeStudentFeeDeleteResource(policy),
      ),
    ),
    gates: {
      preSave: validateStudentFeeSave,
      preDelete: validateStudentFeeDelete,
    },
    atomicExecution,
  })

function resolveStudentFeeWriteOperation(
  entity: StudentFee,
  existing: StudentFee | undefined,
): OperationRef {
  if (existing?.status !== FeeStatus.Cancelled && entity.status === FeeStatus.Cancelled) {
    return FinanceOperations.paymentCancel
  }
  return FinanceOperations.paymentRecord
}

function authorizeStudentFeeResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentFee>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeStudentFeeDeleteResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentFee>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.id])
  }
}

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

async function validateStudentFeeDelete(
  studentFee: StudentFee,
  repositories: SchoolRepositories,
): Promise<void> {
  const payments = await repositories.payments.list({ studentFeeId: studentFee.id })
  if (payments.length > 0) {
    throw new BusinessRuleViolationError('STUDENT_FEE_HAS_DEPENDENCIES', `Cannot delete student fee ${studentFee.id}: dependent records still exist`)
  }
}
