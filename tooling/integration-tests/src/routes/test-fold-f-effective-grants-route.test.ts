import {
  MINIMAL_AUTH_FIXTURE_GUARDIAN_ID,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

const GUARDIAN_EMAIL = 'c.laurent@mail.com'

describeWithLightSchool('Fold F effective grants route', (getContext) => {
  it('returns guardian capabilities with empty permission grants when X-Actor-Kind is guardian', async () => {
    const { app, application, authHeaders } = getContext()
    const authorization = (await authHeaders(GUARDIAN_EMAIL)).authorization
    const guardian = await application.repositories.guardians.findById(MINIMAL_AUTH_FIXTURE_GUARDIAN_ID)

    const response = await app.request(createAppRequest('/core/authorization/effective-grants', {
      headers: {
        authorization,
        'x-actor-kind': 'guardian',
      },
    }))

    expect(response.status).toBe(200)

    const body = await response.json() as {
      kind: string
      actorId: string
      schoolId: string
      capabilities?: string[]
      effectiveGrants: {
        permissions: string[]
        scopeGrants: unknown[]
      }
    }

    expect(body.kind).toBe('guardian')
    expect(body.actorId).toBe(MINIMAL_AUTH_FIXTURE_GUARDIAN_ID)
    expect(body.schoolId).toBe(guardian!.schoolId)
    expect(body.effectiveGrants.permissions).toEqual([])
    expect(body.capabilities?.length).toBeGreaterThan(0)
  })

  it('still returns staff grants when the same session omits X-Actor-Kind', async () => {
    const { app, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization

    const response = await app.request(createAppRequest('/core/authorization/effective-grants', {
      headers: { authorization },
    }))

    expect(response.status).toBe(200)
    const body = await response.json() as { kind: string, effectiveGrants: { permissions: string[] } }
    expect(body.kind).toBe('staff')
    expect(body.effectiveGrants.permissions.length).toBeGreaterThan(0)
  })
})
