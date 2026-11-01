import type { StudentYearAccount } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'
import { assertSchoolCurrency } from '../../../../capabilities/finance/school-currency'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

export const studentYearAccountConfig: EntityConfigFactory<StudentYearAccount> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.studentYearAccounts,
    tenant: accountTenant(),
    resource: 'studentYearAccounts',
    gates: {
      preSave: validateStudentYearAccountSave,
      preDelete: validateStudentYearAccountDelete,
    },
    atomicExecution,
  })

function accountTenant(): EntityTenantResolver<StudentYearAccount> {
  return indirectTenant(async entity => entity.schoolId)
}

export async function validateStudentYearAccountSave(
  entity: StudentYearAccount,
  existing: StudentYearAccount | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertSchoolCurrency(repositories, entity.schoolId, entity.currency)
  if (entity.availableBalance.amount < 0) {
    throw new BusinessRuleViolationError('NEGATIVE_AVAILABLE_FUNDS', `Account ${entity.id} available funds cannot be negative`)
  }
  if (!existing)
    return
  if (existing.schoolId !== entity.schoolId || existing.studentId !== entity.studentId
    || existing.academicYearId !== entity.academicYearId || existing.currency !== entity.currency) {
    throw new BusinessRuleViolationError('ACCOUNT_IDENTITY_LOCKED', `Account ${existing.id} identity cannot change`)
  }
}

async function validateStudentYearAccountDelete(): Promise<void> {
  throw new BusinessRuleViolationError('ACCOUNT_DELETE_BLOCKED', 'Student year accounts cannot be deleted')
}
