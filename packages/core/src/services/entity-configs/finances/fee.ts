import type { Fee } from '../../../entities/finances/fee'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization'
import { directEntityConfig, readByIds } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const feeConfig: EntityConfigFactory<Fee> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.fees,
    'finance.read',
    'finance.manage',
    readByIds((actor, ids) => input.policy.checkFeeAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateFeeSave,
      preDelete: validateFeeDelete,
    },
  }
}

export async function validateFeeSave(
  fee: Fee,
  _existing: Fee | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [school, academicYear] = await Promise.all([
    repositories.schools.findById(fee.schoolId),
    repositories.academicYears.findById(fee.academicYearId),
  ])
  if (!school || !academicYear || academicYear.schoolId !== fee.schoolId) {
    denyResourceAccess()
  }
}

async function validateFeeDelete(
  fee: Fee,
  repositories: SchoolRepositories,
): Promise<void> {
  const studentFees = await repositories.studentFees.list({ feeId: fee.id })
  if (studentFees.length > 0) {
    throw new BusinessRuleViolationError('FEE_HAS_DEPENDENCIES', `Cannot delete fee ${fee.id}: dependent records still exist`)
  }
}
