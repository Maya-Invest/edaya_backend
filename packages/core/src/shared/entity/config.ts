import type { AuthorizationPolicy } from '../../authorization'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { BaseRepositoryInterface } from '../../ports/base-repository'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityReadAuthorization, ManagedEntityServiceConfig } from '../../services'
import { action, authorizeDeleteByReadAccess, authorizeExistingById, noopReadAccess, read, write } from './authorization'
import { directSchoolTenant } from './tenant'

export interface EntityConfigFactoryInput {
  repositories: SchoolRepositories
  policy: AuthorizationPolicy
  atomicExecution: AtomicExecutionPort
}

export type EntityConfigFactory<T> = (input: EntityConfigFactoryInput) => ManagedEntityServiceConfig<T>

export interface EntityWithSchoolId {
  schoolId?: string
}

export interface EntityWithId {
  id: string
}

export function config<T>(input: ManagedEntityServiceConfig<T>): ManagedEntityServiceConfig<T> {
  return input
}

export function directEntityConfig<T extends EntityWithSchoolId & EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readAction: string,
  writeAction: string,
  readAccess: EntityReadAuthorization<T>['checkAccess'] = noopReadAccess,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: directSchoolTenant<T>(),
    read: read(action(policy, readAction), readAccess),
    write: write(action(policy, writeAction), authorizeExistingById(readAccess), authorizeDeleteByReadAccess(readAccess)),
    atomicExecution,
  })
}
