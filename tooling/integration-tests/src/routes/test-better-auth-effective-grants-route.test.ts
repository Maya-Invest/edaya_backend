import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('better auth effective grants route', (getContext) => {
  it('returns effective grants after sign-in through the app router', async () => {
    const { app, application, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const response = await app.request(createAppRequest('/core/authorization/effective-grants', {
      headers: {
        authorization,
      },
    }))

    expect(response.status).toBe(200)

    const body = await response.json() as {
      kind: string
      actorId: string
      schoolId: string
      assuranceLevel: string
      grants: { permission: string, scopes: unknown[], source: string }[]
    }

    expect(body.kind).toBe('staff')
    expect(body.actorId).toBe(MINIMAL_AUTH_FIXTURE_STAFF_ID)
    expect(staff?.schoolId).toBeTruthy()
    expect(body.schoolId).toBe(staff!.schoolId)
    expect(body.assuranceLevel).toBe('verified')
    expect(body.grants.length).toBeGreaterThan(0)
    expect(body.grants.every(grant => typeof grant.permission === 'string' && grant.scopes.length > 0)).toBe(true)
    expect(body).not.toHaveProperty('effectiveGrants')
    expect(body).not.toHaveProperty('capabilities')
  })

  it('returns 401 when the access token is missing', async () => {
    const { app } = getContext()
    const response = await app.request(createAppRequest('/core/authorization/effective-grants'))
    expect(response.status).toBe(401)
  })
})
