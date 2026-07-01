import type { AuthorizationPolicy, Permission } from '../../../capabilities/authorization'
import type { AtomicExecutionPort } from '../../../ports/platform/atomic-execution'
import type { BaseRepositoryInterface } from '../../../ports/repositories/base-repository'
import type { NotificationGatewayPort } from '../../../ports/gateways/notification-gateway'
import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EntityReadAuthorization, ManagedEntityServiceConfig } from '../../../application/entities/managed-entity-service'
import { authorizeDeleteByReadAccess, authorizeExistingById, noopReadAccess, permissionAction, read, write } from './authorization'
import { directSchoolTenant } from './tenant'

export interface EntityConfigFactoryInput {
  repositories: SchoolRepositories
  policy: AuthorizationPolicy
  atomicExecution: AtomicExecutionPort
  notificationGateway: NotificationGatewayPort
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
  const { atomicExecution } = input

  return config({
    repository,
    tenant: directSchoolTenant<T>(),
    read: read(permissionAction(readPermission), readAccess),
    write: write(permissionAction(writePermission), authorizeExistingById(readAccess), authorizeDeleteByReadAccess(readAccess)),
    atomicExecution,
  })
}
