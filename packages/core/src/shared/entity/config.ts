import type { AuthorizationPolicy, Permission } from '../../authorization'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { BaseRepositoryInterface } from '../../ports/base-repository'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityReadAuthorization, ManagedEntityServiceConfig } from '../../services'
import { authorizeDeleteByReadAccess, authorizeExistingById, noopReadAccess, permissionAction, read, write } from './authorization'
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

export function directPermissionEntityConfig<T extends EntityWithSchoolId & EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readPermission: Permission,
  writePermission: Permission,
  readAccess: EntityReadAuthorization<T>['checkAccess'] = noopReadAccess,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: directSchoolTenant<T>(),
    read: read(permissionAction(policy, readPermission), readAccess),
    write: write(permissionAction(policy, writePermission), authorizeExistingById(readAccess), authorizeDeleteByReadAccess(readAccess)),
    atomicExecution,
  })
}
