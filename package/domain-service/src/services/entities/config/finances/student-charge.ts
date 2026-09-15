import type { StudentCharge } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { BusinessRuleViolationError, ChargeStatus } from '@edaya/core'
import { config } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

export const studentChargeConfig: EntityConfigFactory<StudentCharge> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.studentCharges,
    tenant: chargeTenant(),
    resource: 'studentCharges',
    gates: {
      preSave: validateStudentChargeSave,
      preDelete: validateStudentChargeDelete,
    },
    atomicExecution,
  })

function chargeTenant(): EntityTenantResolver<StudentCharge> {
  return indirectTenant(async entity => entity.schoolId)
}

export async function validateStudentChargeSave(
  entity: StudentCharge,
  existing: StudentCharge | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!existing)
    return
  if (existing.schoolId !== entity.schoolId || existing.studentId !== entity.studentId || existing.enrollmentId !== entity.enrollmentId) {
    throw new BusinessRuleViolationError('CHARGE_IDENTITY_LOCKED', `Charge ${existing.id} identity cannot change`)
  }
  if (existing.expectedAmount.amount !== entity.expectedAmount.amount || existing.currency !== entity.currency) {
    throw new BusinessRuleViolationError('CHARGE_AMOUNT_IMMUTABLE', `Charge ${existing.id} expected amount cannot change`)
  }
  if (JSON.stringify(existing.installments) !== JSON.stringify(entity.installments)) {
    throw new BusinessRuleViolationError('CHARGE_SCHEDULE_IMMUTABLE', `Charge ${existing.id} installment schedule cannot change`)
  }
  if (existing.status === ChargeStatus.Cancelled && entity.status === ChargeStatus.Cancelled && cancellationChanged(entity, existing)) {
    throw new BusinessRuleViolationError('ALREADY_CANCELLED_CHARGE', `Charge ${existing.id} has already been cancelled`)
  }
  if (existing.status !== ChargeStatus.Cancelled && entity.status === ChargeStatus.Cancelled) {
    const allocations = await repositories.allocations.list({ chargeId: existing.id })
    const active = allocations.filter(allocation => allocation.isSettle && !allocations.some(other => other.reversesAllocationId === allocation.id))
    if (active.length > 0 || existing.allocatedAmount.amount > 0) {
      throw new BusinessRuleViolationError('CHARGE_HAS_ACTIVE_ALLOCATIONS', `Charge ${existing.id} cannot be cancelled while active allocations remain`)
    }
  }
  const adjustmentChanged = entity.adjustmentAmount.amount !== existing.adjustmentAmount.amount
    || entity.adjustmentReason !== existing.adjustmentReason
    || entity.adjustedById !== existing.adjustedById
    || dateTime(entity.adjustedAt) !== dateTime(existing.adjustedAt)
  const waiverChanged = entity.waiverAmount.amount !== existing.waiverAmount.amount
    || entity.waiverReason !== existing.waiverReason
    || entity.waivedById !== existing.waivedById
    || dateTime(entity.waivedAt) !== dateTime(existing.waivedAt)
  if ((adjustmentChanged || waiverChanged) && existing.status === ChargeStatus.Cancelled) {
    throw new BusinessRuleViolationError('CANCELLED_CHARGE_ADJUSTMENT', `Charge ${existing.id} cannot be adjusted after cancellation`)
  }
  if (adjustmentChanged && existing.adjustmentAmount.amount > 0 && entity.adjustmentAmount.amount !== existing.adjustmentAmount.amount) {
    throw new BusinessRuleViolationError('ALREADY_ADJUSTED_CHARGE', `Charge ${existing.id} has already been adjusted`)
  }
  if (waiverChanged && existing.waiverAmount.amount > 0 && entity.waiverAmount.amount !== existing.waiverAmount.amount) {
    throw new BusinessRuleViolationError('ALREADY_WAIVED_CHARGE', `Charge ${existing.id} has already been waived`)
  }
  if (entity.adjustmentAmount.amount + entity.waiverAmount.amount + entity.allocatedAmount.amount > entity.expectedAmount.amount) {
    throw new BusinessRuleViolationError('ADJUSTMENT_BELOW_SETTLEMENT', 'adjustments and waivers must not reduce a charge below active settlement')
  }
}

function cancellationChanged(entity: StudentCharge, existing: StudentCharge): boolean {
  return entity.cancellationReason !== existing.cancellationReason
    || entity.cancelledById !== existing.cancelledById
    || dateTime(entity.cancelledAt) !== dateTime(existing.cancelledAt)
}

async function validateStudentChargeDelete(): Promise<void> {
  throw new BusinessRuleViolationError('CHARGE_DELETE_BLOCKED', 'Charges cannot be deleted; cancel them instead')
}
