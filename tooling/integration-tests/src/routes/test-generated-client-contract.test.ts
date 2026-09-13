import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { expect, it } from 'bun:test'
import { createInProcessSchoolClient } from '../support/in-process-school-client'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('generated school client contract', (getContext) => {
  it('lists schools and reads effective grants through createSchoolClient', async () => {
    const { app, application, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const staff = await application.repositories.staffMembers.findById(MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const client = createInProcessSchoolClient(app, {
      headers: { authorization },
    })

    const schools = await client.entities.schools.list({ $limit: 1 })
    expect(schools.length).toBeGreaterThan(0)

    const grants = await client.authorization.effectiveGrants()
    expect(grants).toMatchObject({
      kind: 'staff',
      actorId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      schoolId: staff?.schoolId,
      assuranceLevel: 'verified',
    })
    expect(grants).toHaveProperty('grants', expect.any(Array))
  })

  it('returns 401 from generated authorization routes without a session cookie', async () => {
    const { app } = getContext()
    const client = createInProcessSchoolClient(app)

    await expect(client.authorization.effectiveGrants()).rejects.toMatchObject({
      status: 401,
    })
  })
})
