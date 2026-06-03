import type { ActorMetadata } from '../../../src/authorization'
import type { BaseRepositoryInterface } from '../../../src/ports'
import { createStore } from '../../support/create-test-app'

export interface TestEntity {
  id: string
  schoolId: string
  parentId?: string
}

export const actor: ActorMetadata = {
  kind: 'system',
  systemId: 'system',
  schoolId: 'school',
  requestId: 'request',
  reason: 'test',
}

export function createRepository<T extends { id: string }>(): BaseRepositoryInterface<T> {
  return createStore<T>() as BaseRepositoryInterface<T>
}
