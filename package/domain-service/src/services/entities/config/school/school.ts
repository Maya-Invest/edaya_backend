import type { BaseRepositoryInterface, School } from '@edaya/core'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityTenantResolver, EntityWithId, ManagedEntityServiceConfig } from '../../entity-config'
import { SchoolStructureOperations, WorkspaceOperations } from '@edaya/authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'
import { resolveIdFromFilter } from '../../entity-config/tenant'

// Extracted from domain/school/school.ts (PR3)
export const schoolConfig: EntityConfigFactory<School> = (input) => {
  const managedConfig = schoolEntityConfig(input, input.repositories.schools)
  managedConfig.read.checkModule = operationModule(WorkspaceOperations.read)
  managedConfig.write.checkModule = operationModule(SchoolStructureOperations.lifecycleManage)
  return managedConfig
}

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
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
    read: read(operationModule(WorkspaceOperations.read), noopReadAccess),
    write: write(operationModule(SchoolStructureOperations.lifecycleManage), noopSaveAccess, noopDeleteAccess),
    atomicExecution,
  })
}
