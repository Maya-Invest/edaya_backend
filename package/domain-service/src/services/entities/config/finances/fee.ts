import type { Fee } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/finances/fee.ts (PR3)
export const feeConfig: EntityConfigFactory<Fee> = ({ repositories, atomicExecution }) => {
  return config({
    repository: repositories.fees,
    tenant: directSchoolTenant(),
    resource: 'fees',

    gates: {
      preSave: validateFeeSave,
      preDelete: validateFeeDelete,
    },
    atomicExecution,
  })
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

export async function validateFeeDelete(
  fee: Fee,
  repositories: SchoolRepositories,
): Promise<void> {
  const studentFees = await repositories.studentFees.list({ feeId: fee.id })
  if (studentFees.length > 0) {
    throw new BusinessRuleViolationError('FEE_HAS_DEPENDENCIES', `Cannot delete fee ${fee.id}: dependent records still exist`)
  }
}
