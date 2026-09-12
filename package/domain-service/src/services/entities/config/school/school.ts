import { Permission } from '@edaya/core';
import type { BaseRepositoryInterface, Filter, School } from '@edaya/core';
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityTenantResolver, EntityWithId, ManagedEntityServiceConfig } from '../../entity-config';

import { config } from '../../entity-config';
import { resolveIdFromFilter } from '../../entity-config/tenant';

// Extracted from domain/school/school.ts (PR3)
export const schoolConfig: EntityConfigFactory<School> = input => schoolEntityConfig(input, input.repositories.schools)

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
    authorization: { resource: 'schools', read: Permission.QUERY_WORKSPACE_READ, write: Permission.SCHOOL_LIFECYCLE_MANAGE },
    atomicExecution,
  })
}
