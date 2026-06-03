import type { AuthorizationPolicy } from '../../../src/authorization'
import type { AtomicExecutionPort, SchoolRepositories } from '../../../src/ports'
import { describe, expect, test } from 'bun:test'
import { createSystemActorMetadata } from '../../../src/authorization'
import { SchoolApplication, SchoolService } from '../../../src'

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
    })

    const service = application.forActor(actor)

    expect(application.repositories).toBe(repositories)
    expect(service).toBeInstanceOf(SchoolService)
    expect(service.baseService.actor).toBe(actor)
    expect(service.baseService.authorizationPolicy).toBe(authorizationPolicy)
    expect(service.baseService.repositories).toBe(repositories)
    expect(service.baseService.atomicExecution).toBe(atomicExecution)
  })

  test('does not expose legacy grouped services', () => {
    const application = new SchoolApplication({
      authorizationPolicy,
      repositories,
      atomicExecution,
    })

    const serviceProperties = application.forActor(actor) as unknown as Record<string, unknown>

    expect(serviceProperties['setup']).toBeUndefined()
    expect(serviceProperties['students']).toBeUndefined()
    expect(serviceProperties['finance']).toBeUndefined()
    expect(serviceProperties['queries']).toBeUndefined()
    expect(serviceProperties['config']).toBeUndefined()
  })
})
