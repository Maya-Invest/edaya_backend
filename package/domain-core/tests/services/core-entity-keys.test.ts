import type {
  ActorMetadata,
  AtomicExecutionPort,
  AuthorizationPolicy,
  BaseRepositoryInterface,
  SchoolRepositories,
} from '../../src'
import { describe, expect, test } from 'bun:test'
import { BaseSchoolService, CORE_ENTITY_KEYS, noOpNotificationGateway } from '../../src'
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
