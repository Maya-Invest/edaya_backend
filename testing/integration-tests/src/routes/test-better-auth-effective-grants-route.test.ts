import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/dev-fixtures'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import {
  createAppRequest,
  createCoreRouteTestApp,
  seedDevSchoolAndAuthLinks,
  signInThroughApp,
} from '../support/api-route-harness'

describe('better auth effective grants route', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('returns effective grants after sign-in through the app router', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await seedDevSchoolAndAuthLinks(application, runtime)

    const cookies = await signInThroughApp(app, { email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL })
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const response = await app.request(createAppRequest('/core/authorization/effective-grants', {
      headers: {
        cookie: cookies.join('; '),
      },
    }))

    expect(response.status).toBe(200)

    const body = await response.json() as {
      kind: string
      actorId: string
      schoolId: string
      assuranceLevel: string
      effectiveGrants: {
        permissions: string[]
        scopeGrants: unknown[]
        isElevated: boolean
      }
    }

    expect(body.kind).toBe('staff')
    expect(body.actorId).toBe(MINIMAL_AUTH_FIXTURE_STAFF_ID)
    expect(staff?.schoolId).toBeTruthy()
    expect(body.schoolId).toBe(staff!.schoolId)
    expect(body.assuranceLevel).toBe('standard')
    expect(Array.isArray(body.effectiveGrants.permissions)).toBe(true)
    expect(Array.isArray(body.effectiveGrants.scopeGrants)).toBe(true)
  }, 30_000)

  it('returns 401 when the session cookie is missing', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await seedDevSchoolAndAuthLinks(application, runtime)

    const response = await app.request(createAppRequest('/core/authorization/effective-grants'))
    expect(response.status).toBe(401)
  }, 30_000)
})
