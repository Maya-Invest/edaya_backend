import { createSchoolBootstrapActor } from '@edaya/authorization'
import {
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { expect, it } from 'bun:test'
import {
  createAppRequest,
  grantAccessControlAssign,
  signUpAuthUser,
} from '../support/api-route-harness'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

const UNLINKED_STAFF_ID = 'st9'

describeWithLightSchool('link-actor-subject command route', (getContext) => {
  it('links a staff member to a Better Auth subject through the command route', async () => {
    const { app, runtime, application, authHeaders } = getContext()
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const bootstrapActor = createSchoolBootstrapActor({
      schoolId: SEED_SCHOOL_ID,
      requestId: 'link-actor-subject-test',
    })
    const service = application.forActor(bootstrapActor)

    await service.setupWorkflow.registerStaffMember({
      id: UNLINKED_STAFF_ID,
      schoolId: SEED_SCHOOL_ID,
      firstName: 'Paul',
      lastName: 'Martin',
      email: 'p.martin@school.edu',
    })

    const subjectId = await signUpAuthUser(runtime, {
      email: 'p.martin@school.edu',
      name: 'Paul Martin',
    })

    const response = await app.request(createAppRequest('/core/commands/link-actor-subject', {
      method: 'POST',
      headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL),
      body: JSON.stringify({
        subjectId,
        staffMemberId: UNLINKED_STAFF_ID,
      }),
    }))

    expect(response.status).toBe(200)

    const body = await response.json() as {
      kind: string
      entity: {
        id: string
        subjectId: string
      }
    }

    expect(body.kind).toBe('staff')
    expect(body.entity.id).toBe(UNLINKED_STAFF_ID)
    expect(body.entity.subjectId).toBe(subjectId)

    const linkedStaff = await application.repositories.staffMembers.findById(UNLINKED_STAFF_ID)
    expect(linkedStaff?.subjectId).toBe(subjectId)
  })

  it('returns 401 when the caller is not authenticated', async () => {
    const { app } = getContext()

    const response = await app.request(createAppRequest('/core/commands/link-actor-subject', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subjectId: 'auth-user-unauthenticated',
        staffMemberId: DEV_AUTH_STAFF_ACCOUNTS[1].staffId,
      }),
    }))

    expect(response.status).toBe(401)
  })
}, { isolate: true })
