import type { AuthorizationPolicy } from '../../../src/authorization'
import type { AtomicExecutionPort, SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import { SchoolApplication, SchoolService } from '../../../src'
import { createSystemActorMetadata } from '../../../src/authorization'
import { noOpNotificationGateway } from '../../../src/notifications'
import { testFileStorage } from '../../support/test-file-storage'

describe('SchoolApplication', () => {
  const actor = createSystemActorMetadata({
    systemId: 'system',
    schoolId: 'school',
    requestId: 'request',
    reason: 'school application facade test',
  })

  const authorizationPolicy = {} as AuthorizationPolicy
  const repositories = {} as SchoolRepositories
  const atomicExecution: AtomicExecutionPort = {
    execute: async operation => operation(),
  }

  test('creates actor-scoped SchoolService instances', () => {
    const application = new SchoolApplication({
      authorizationPolicy,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    const service = application.forActor(actor)

    expect(application.repositories).toBe(repositories)
    expect(service).toBeInstanceOf(SchoolService)
    expect(service.baseService.actor).toBe(actor)
    expect(service.baseService.authorizationPolicy).toBe(authorizationPolicy)
    expect(service.baseService.repositories).toBe(repositories)
    expect(service.baseService.atomicExecution).toBe(atomicExecution)
    expect(service.baseService.notificationGateway).toBe(noOpNotificationGateway)
  })

  test('does not expose legacy grouped services', () => {
    const application = new SchoolApplication({
      authorizationPolicy,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    const serviceProperties = application.forActor(actor) as unknown as {
      setup?: unknown
      students?: unknown
      finance?: unknown
      queries?: unknown
      config?: unknown
    }

    expect(serviceProperties.setup).toBeUndefined()
    expect(serviceProperties.students).toBeUndefined()
    expect(serviceProperties.finance).toBeUndefined()
    expect(serviceProperties.queries).toBeUndefined()
    expect(serviceProperties.config).toBeUndefined()
  })
})
