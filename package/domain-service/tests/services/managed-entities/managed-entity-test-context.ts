import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { BaseRepositoryInterface } from '@edaya/core'
import { createStore } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

export interface TestEntity {
  id: string
  schoolId: string
  parentId?: string
}

export const actor: SchoolScopedActorMetadata = createTestStaffActor()

export function createRepository<T extends { id: string }>(): BaseRepositoryInterface<T> {
  return createStore<T>() as BaseRepositoryInterface<T>
}
