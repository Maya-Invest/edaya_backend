import type { ActorMetadata } from '../../../src/authorization'
import type { BaseRepositoryInterface } from '../../../src/ports'
import { createStore } from '../../support/create-test-app'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'

export interface TestEntity {
  id: string
  schoolId: string
  parentId?: string
}

export const actor: ActorMetadata = createElevatedTestStaffActor()

export function createRepository<T extends { id: string }>(): BaseRepositoryInterface<T> {
  return createStore<T>() as BaseRepositoryInterface<T>
}
