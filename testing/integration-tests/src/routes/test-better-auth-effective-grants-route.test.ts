import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool } from '../support/seeded-route-test-context'

describeWithSeededSchool('better auth effective grants route', (getContext) => {
  it('returns effective grants after sign-in through the app router', async () => {
    const { app, application, authHeaders } = getContext()
    const cookies = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).cookie
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const response = await app.request(createAppRequest('/core/authorization/effective-grants', {
      headers: {
        cookie: cookies,
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
    expect(body.assuranceLevel).toBe('verified')
    expect(Array.isArray(body.effectiveGrants.permissions)).toBe(true)
    expect(Array.isArray(body.effectiveGrants.scopeGrants)).toBe(true)
  })

  it('returns 401 when the session cookie is missing', async () => {
    const { app } = getContext()
    const response = await app.request(createAppRequest('/core/authorization/effective-grants'))
    expect(response.status).toBe(401)
  })
})
