import type { ActorMetadata, AuthorizationPolicy } from '@edaya/authorization'
import type { AtomicExecutionPort, BaseRepositoryInterface } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/school-service'
import { noOpNotificationGateway } from '@edaya/core'
import { BaseSchoolService, CORE_ENTITY_KEYS } from '@edaya/school-service'
import { describe, expect, test } from 'bun:test'
import { testFileStorage } from '../support/test-file-storage'

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual)
  const expectedKeys = new Set(expected)
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  }
}

describe('core entity keys', () => {
  test('match the managed services constructed by BaseSchoolService', () => {
    const repository = new Proxy({}, {
      get: () => async () => undefined,
    }) as BaseRepositoryInterface<unknown>
    const repositories = new Proxy({}, {
      get: () => repository,
    }) as SchoolRepositories
    const authorizationPolicy = new Proxy({}, {
      get: () => async () => undefined,
    }) as AuthorizationPolicy
    const atomicExecution: AtomicExecutionPort = {
      execute: operation => operation(),
    }

    const service = new BaseSchoolService({
      actor: {} as ActorMetadata,
      repositories,
      authorizationPolicy,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    expect(keyDifference(Object.keys(service.entities), CORE_ENTITY_KEYS)).toEqual({
      missing: [],
      extra: [],
    })
  })
})
