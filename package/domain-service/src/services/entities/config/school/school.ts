import type { BaseRepositoryInterface, Filter, School } from '@edaya/core'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityTenantResolver, EntityWithId, ManagedEntityServiceConfig } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'

import { config } from '../../entity-config'

import { resolveIdFromFilter } from '../../entity-config/tenant'
import { validateSchoolOwnership } from './validate-school-ownership'

// Extracted from domain/school/school.ts (PR3)
export const schoolConfig: EntityConfigFactory<School> = input => ({
  ...schoolEntityConfig(input, input.repositories.schools),
  writeLockGroup: '0-finance-state',
  gates: { preSave: async (school, existing, repositories) => {
    validateSchoolOwnership(school, existing)
    if (existing && existing.financeCurrency !== school.financeCurrency) {
      const counts = await Promise.all([
        repositories.catalogServices.count({ schoolId: school.id }),
        repositories.studentYearAccounts.count({ schoolId: school.id }),
        repositories.studentCharges.count({ schoolId: school.id }),
        repositories.payments.count({ schoolId: school.id }),
      ])
      if (counts.some(count => count > 0))
        throw new BusinessRuleViolationError('SCHOOL_CURRENCY_LOCKED', 'School currency cannot change after financial records exist')
    }
  } },
})

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
    scopeFilter: schoolId => ({ id: schoolId } as Filter<T>),
  }
}

export function schoolEntityConfig<T extends EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
): ManagedEntityServiceConfig<T> {
  const { atomicExecution } = input

  return config({
    repository,
    tenant: schoolEntityTenant<T>(),
    resource: 'schools',
    atomicExecution,
  })
}
