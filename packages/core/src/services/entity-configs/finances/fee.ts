import type { Fee } from '../../../entities/finances/fee'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization'
import { directEntityConfig, readByIds } from '../../../shared'

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
