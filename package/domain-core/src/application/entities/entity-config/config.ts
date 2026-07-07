import type { ManagedEntityServiceConfig } from '../../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../../capabilities/authorization'
import type { NotificationGatewayPort } from '../../../ports/gateways/notification-gateway'
import type { AtomicExecutionPort } from '../../../ports/platform/atomic-execution'
import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'

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

export { authorizeDeleteByReadAccess, authorizeExistingById, noopReadAccess, read, write } from './authorization'
