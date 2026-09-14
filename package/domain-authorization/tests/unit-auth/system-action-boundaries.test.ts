import { AccessPolicies, AuthorizationError, createSystemActorMetadata } from '@edaya/authorization'
import { Permission as P } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

// These are the intended job contracts, independently checked against the complete action vocabulary.
const jobs = [
  { id: 'processDueNotifications', actions: [P.EXAM_CONFIG_READ, P.TIMETABLE_READ, P.QUERY_CALENDAR_READ] },
  { id: 'reconcilePendingDeliveries', actions: [P.QUERY_COMMUNICATIONS_READ, P.COMMUNICATION_UPDATE] },
  { id: 'expireAccountInvitations', actions: [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_ASSIGN] },
  { id: 'notify-adapter', actions: [P.COMMUNICATION_CREATE, P.COMMUNICATION_UPDATE, P.QUERY_COMMUNICATIONS_READ] },
  { id: 'notification-delivery-webhook', actions: [P.COMMUNICATION_CREATE, P.COMMUNICATION_UPDATE, P.QUERY_COMMUNICATIONS_READ] },
  { id: 'account-invitation-public', actions: [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_ASSIGN] },
  { id: 'invitation-dispatch', actions: [P.ACCESS_CONTROL_READ] },
  { id: 'preparePrivateFileCleanup', actions: [P.ATTACHMENT_CONFIGURE] },
  { id: 'private-file-cleanup', actions: [P.ATTACHMENT_CONFIGURE] },
  { id: 'school-bootstrap', actions: [P.PLATFORM_REGISTER_SCHOOL, P.SCHOOL_STRUCTURE_CONFIGURE, P.SCHOOL_LIFECYCLE_MANAGE, P.ACCESS_CONTROL_ASSIGN, P.STAFF_CREATE, P.QUERY_WORKSPACE_READ] },
  { id: 'unknown-job', actions: [] },
]

describe('named internal actors have finite school-bound action contracts', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  test.each(jobs)('$id cannot exercise another job’s actions or cross the school boundary', async ({ id, actions }) => {
    const access = new AccessPolicies(createSystemActorMetadata({ schoolId: 'school-a', systemId: id, requestId: 'job-matrix', reason: 'Verify internal action contract' }), fixture.repositories)
    for (const action of Object.values(P)) {
      if (actions.includes(action)) {
        await access.assertResources(action, 'schools', ['school-a'])
        await expect(access.assertResources(action, 'schools', ['school-b'])).rejects.toBeInstanceOf(AuthorizationError)
      }
      else {
        await expect(access.assertSchool(action)).rejects.toBeInstanceOf(AuthorizationError)
      }
    }
  })
})
