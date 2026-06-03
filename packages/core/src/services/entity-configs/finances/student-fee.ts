import type { AuthorizationPolicy } from '../../../authorization/authorization-policy'
import type { StudentFee } from '../../../entities/finances/student-fee'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { FeeStatus } from '../../../entities/finances/student-fee'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, dateTime, indirectTenant, read, readByIds, write } from '../../../shared'

export const studentFeeConfig: EntityConfigFactory<StudentFee> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentFees,
    tenant: studentFeeTenant(),
    read: read(action(policy, 'finance.read'), readByIds((actor, ids) => policy.checkStudentFeeAccess(actor, ids))),
    write: write(action(policy, 'finance.manage'), authorizeStudentFee(policy), authorizeStudentFeeDelete(policy)),
    gates: {
      preSave: validateStudentFeeSave,
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
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

export function authorizeStudentFeeDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentFee>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.id])
  }
}
