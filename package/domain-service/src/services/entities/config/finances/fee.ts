import type { Fee } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess, FinanceOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, operationModule, read, readByIds, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/finances/fee.ts (PR3)
export const feeConfig: EntityConfigFactory<Fee> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = readByIds((actor, ids) => policy.checkFeeAccess(actor, ids))

  return config({
    repository: repositories.fees,
    tenant: directSchoolTenant(),
    read: read(
      operationModule(FinanceOperations.feeCatalogRead),
      readAccess,
    ),
    write: write(
      operationModule(FinanceOperations.feeConfigure),
      authorizeExistingById(readAccess),
      authorizeDeleteByReadAccess(readAccess),
    ),
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
