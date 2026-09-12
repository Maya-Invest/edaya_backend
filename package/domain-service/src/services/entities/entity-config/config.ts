import type { AtomicExecutionPort, NotificationGatewayPort } from '@edaya/core';
import type { SchoolRepositories } from '../../../ports/school-repositories';
import type { ManagedEntityServiceConfig } from '../../entities/managed-entity-service';

export interface EntityConfigFactoryInput {
  repositories: SchoolRepositories
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

