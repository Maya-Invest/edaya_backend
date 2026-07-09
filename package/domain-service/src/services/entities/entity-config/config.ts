import type { AuthorizationPolicy } from '@edaya/authorization'
import type { AtomicExecutionPort, NotificationGatewayPort } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import type { ManagedEntityServiceConfig } from '../../entities/managed-entity-service'

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
