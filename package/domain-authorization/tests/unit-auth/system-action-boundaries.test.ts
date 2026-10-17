import { AccessPolicies, AuthorizationError, createSystemActorMetadata } from '@edaya/authorization'
import { Permission as P } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

// These are the intended job contracts, independently checked against the complete action vocabulary.
const jobs = [
  { id: 'processDueNotifications', actions: [P.ASSESSMENT_READ, P.TIMETABLE_READ, P.ACTIVITY_READ] },
  { id: 'reconcilePendingDeliveries', actions: [P.PERSONAL_COMMUNICATIONS_READ, P.COMMUNICATION_DRAFT_MANAGE] },
  { id: 'expireAccountInvitations', actions: [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_MANAGE] },
  { id: 'notify-adapter', actions: [P.COMMUNICATION_DRAFT_MANAGE, P.PERSONAL_COMMUNICATIONS_READ] },
  { id: 'notification-delivery-webhook', actions: [P.COMMUNICATION_DRAFT_MANAGE, P.PERSONAL_COMMUNICATIONS_READ] },
  { id: 'account-invitation-public', actions: [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_MANAGE] },
  { id: 'invitation-dispatch', actions: [P.ACCESS_CONTROL_READ] },
  { id: 'preparePrivateFileCleanup', actions: [P.ATTACHMENT_CONFIGURE] },
  { id: 'private-file-cleanup', actions: [P.ATTACHMENT_CONFIGURE] },
  { id: 'advanceFamilyFeedbackCampaigns', actions: [P.FAMILY_FEEDBACK_CAMPAIGN_READ, P.FAMILY_FEEDBACK_CAMPAIGN_MANAGE] },
  { id: 'school-bootstrap', actions: [P.PLATFORM_REGISTER_SCHOOL, P.SCHOOL_CONFIGURE, P.SCHOOL_LIFECYCLE_MANAGE, P.ACCESS_CONTROL_MANAGE, P.STAFF_MANAGE, P.WORKSPACE_ACCESS] },
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
      if (action === P.COMMUNICATION_DRAFT_MANAGE && ['notify-adapter', 'notification-delivery-webhook', 'reconcilePendingDeliveries'].includes(id)) {
        await access.scope(action, 'messageDeliveries', 'write', 'update')
        await expect(access.scope(action, 'messageDeliveries', 'write', 'delete')).rejects.toBeInstanceOf(AuthorizationError)
        await expect(access.scope(action, 'announcements', 'write', 'update')).rejects.toBeInstanceOf(AuthorizationError)
      }
      else if (actions.includes(action)) {
        await access.assertResources(action, 'schools', ['school-a'])
        await expect(access.assertResources(action, 'schools', ['school-b'])).rejects.toBeInstanceOf(AuthorizationError)
      }
      else {
        await expect(access.assertSchool(action)).rejects.toBeInstanceOf(AuthorizationError)
      }
    }
  })
})
