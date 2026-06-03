import type { School } from '../../../../entities/school/school'
import type { BaseRepositoryInterface } from '../../../../ports/base-repository'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityWithId } from '../../../shared/common'
import type { EntityTenantResolver, ManagedEntityServiceConfig } from '../../managed-entity-service'
import { action, config, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, resolveIdFromFilter, write } from '../../../shared/common'

export const schoolConfig: EntityConfigFactory<School> = input =>
  schoolEntityConfig(input, input.repositories.schools, 'queries.read_workspace', 'setup.manage_lifecycle')

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
  }
}

export function schoolEntityConfig<T extends EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readAction: string,
  writeAction: string,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: schoolEntityTenant<T>(),
    read: read(action(policy, readAction), noopReadAccess),
    write: write(action(policy, writeAction), noopSaveAccess, noopDeleteAccess),
    atomicExecution,
  })
}
