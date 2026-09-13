import { AuthorizationError, createSystemActorMetadata } from '@edaya/authorization'
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, noOpNotificationGateway } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'
import { expireAccountInvitations } from '../../src/capabilities/scheduling-jobs/jobs/expire-account-invitations'
import { testFileStorage } from '../support/test-file-storage'

describe('invitation expiry uses tenant-bound job policies', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  afterEach(async () => {
    await fixture.db.close()
  })
  test('expires only pending invitations for this school and cannot run under a notification principal', async () => {
    fixture = await createAuthorizationDatabase()
    const revoke = mock(async (_id: string) => {})
    const application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage, invitationDelivery: { deliver: async () => {}, revoke } })
    for (const [id, suffix, expiresAt] of [['expired', 'a', '2026-01-01'], ['active', 'a', '2026-01-03'], ['foreign', 'b', '2026-01-01']] as const)
      await fixture.repositories.accountInvitations.save(new AccountInvitation({ id, schoolId: `school-${suffix}`, kind: AccountInvitationKind.Staff, targetId: `staff-${suffix}`, contactChannel: AccountInvitationContactChannel.Email, contactValue: 'staff@example.test', tokenHash: `hash-${id}`, status: AccountInvitationStatus.Pending, expiresAt: new Date(expiresAt), createdByStaffId: `staff-${suffix}` }))
    const actor = createSystemActorMetadata({ systemId: 'expireAccountInvitations', schoolId: 'school-a', requestId: 'expiry', reason: 'Expire invitations' })
    const asOf = new Date('2026-01-02')
    expect(await expireAccountInvitations({ actor, asOf, service: application.forActor(actor) })).toEqual({ processed: 1, skipped: 1 })
    expect(revoke).toHaveBeenCalledWith('expired')
    expect(revoke).toHaveBeenCalledTimes(1)
    expect((await fixture.repositories.accountInvitations.findById('expired'))?.status).toBe(AccountInvitationStatus.Expired)
    expect((await fixture.repositories.accountInvitations.findById('foreign'))?.status).toBe(AccountInvitationStatus.Pending)
    const otherJob = { ...actor, systemId: 'processDueNotifications' }
    await expect(expireAccountInvitations({ actor: otherJob, asOf, service: application.forActor(otherJob) })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
