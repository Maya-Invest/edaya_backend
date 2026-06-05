import type { School } from '../../../entities/school/school'
import type { BaseRepositoryInterface } from '../../../ports/base-repository'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityWithId } from '../../../shared'
import type { EntityTenantResolver, ManagedEntityServiceConfig } from '../../managed-entity-service'
import { Permission } from '../../../authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveIdFromFilter, write } from '../../../shared'

export const schoolConfig: EntityConfigFactory<School> = input =>
  schoolEntityConfig(input, input.repositories.schools, Permission.QUERY_WORKSPACE_READ, Permission.SCHOOL_LIFECYCLE_MANAGE)

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
  }
}

export function schoolEntityConfig<T extends EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readPermission: Permission,
  writePermission: Permission,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: schoolEntityTenant<T>(),
    read: read(permissionAction(policy, readPermission), noopReadAccess),
    write: write(permissionAction(policy, writePermission), noopSaveAccess, noopDeleteAccess),
    atomicExecution,
  })
}
