import type { AuthorizationPolicy } from '../../../src/capabilities/authorization'
import type { AtomicExecutionPort, SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import { SchoolApplication, SchoolService } from '../../../src'
import { noOpNotificationGateway } from '../../../src/adapters'
import { createSystemActorMetadata } from '../../../src/capabilities/authorization'
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

  test('delegates auth account lookup to the configured resolver', async () => {
    const application = new SchoolApplication({
      authorizationPolicy,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
      authContactResolver: {
        resolveBySubjectId: async () => undefined,
        hasAccountForEmail: async email => email === 'known@school.test',
      },
    })

    await expect(application.hasAuthAccountForEmail('known@school.test')).resolves.toBe(true)
    await expect(application.hasAuthAccountForEmail('unknown@school.test')).resolves.toBe(false)
  })

  test('returns false when no auth contact resolver is configured', async () => {
    const application = new SchoolApplication({
      authorizationPolicy,
      repositories,
      atomicExecution,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    await expect(application.hasAuthAccountForEmail('anyone@school.test')).resolves.toBe(false)
  })
})
