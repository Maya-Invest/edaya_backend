import { createSystemActorMetadata } from '@edaya/core'
import {
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import {
  createAppRequest,
  createCoreRouteTestApp,
  grantAccessControlAssign,
  seedDevSchoolAndAuthLinks,
  signInThroughApp,
  signUpAuthUser,
} from '../support/api-route-harness'

const UNLINKED_STAFF_ID = 'st9'

describe('link-actor-subject command route', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('links a staff member to a Better Auth subject through the command route', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await seedDevSchoolAndAuthLinks(application, runtime)
    await grantAccessControlAssign(application, MINIMAL_AUTH_FIXTURE_STAFF_ID)

    const systemActor = createSystemActorMetadata({
      systemId: 'link-actor-subject-test',
      schoolId: SEED_SCHOOL_ID,
      requestId: 'link-actor-subject-test',
      reason: 'Register staff for link-actor-subject route test',
    })
    const service = application.forActor(systemActor)

    await service.registerStaffMember({
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

    const cookies = await signInThroughApp(app, { email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL })

    const response = await app.request(createAppRequest('/core/commands/link-actor-subject', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cookie': cookies.join('; '),
      },
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
  }, 30_000)

  it('returns 401 when the caller is not authenticated', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    await seedDevSchoolAndAuthLinks(application, runtime)

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
  }, 30_000)
})
