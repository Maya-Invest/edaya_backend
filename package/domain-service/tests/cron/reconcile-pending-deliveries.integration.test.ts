import { AuthorizationError, createSystemActorMetadata } from '@edaya/authorization'
import { MessageDelivery, MessageDeliveryRecipientKind, MessageDeliveryStatus, noOpNotificationGateway, RecordingNotificationGateway } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'
import { reconcilePendingDeliveries } from '../../src/capabilities/scheduling-jobs/jobs/reconcile-pending-deliveries'
import { testFileStorage } from '../support/test-file-storage'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('delivery reconciliation uses its explicit job authority', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createSystemActorMetadata({ systemId: 'reconcilePendingDeliveries', schoolId: 'school-a', requestId: 'reconcile', reason: 'Status reconciliation' })
  const asOf = new Date('2026-06-24T00:05:00Z')
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    for (const suffix of ['a', 'b']) await fixture.repositories.messageDeliveries.save(new MessageDelivery({ id: `delivery-${suffix}`, schoolId: `school-${suffix}`, subjectId: `person-${suffix}`, title: 'News', body: 'Private', recipientKind: MessageDeliveryRecipientKind.Staff, recipientId: `staff-${suffix}` }))
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  test('reconciles only its school and rejects unrelated job identities', async () => {
    const gateway = new RecordingNotificationGateway()
    gateway.setStatusLookup('school-a', 'delivery-a', { status: 'sent', providerMessageId: 'provider-message', occurredAt: asOf })
    const application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: gateway, fileStorage: testFileStorage })
    expect(await reconcilePendingDeliveries({ asOf, actor, service: application.forActor(actor) })).toEqual({ processed: 1, skipped: 0 })
    expect(gateway.statusLookups).toEqual([[{ schoolId: 'school-a', deliveryId: 'delivery-a', subjectId: 'person-a' }]])
    expect((await fixture.repositories.messageDeliveries.findById('delivery-a'))?.status).toBe(MessageDeliveryStatus.Sent)
    expect((await fixture.repositories.messageDeliveries.findById('delivery-b'))?.status).toBe(MessageDeliveryStatus.Pending)
    const unrelated = { ...actor, systemId: 'expireAccountInvitations' }
    await expect(reconcilePendingDeliveries({ asOf, actor: unrelated, service: application.forActor(unrelated) })).rejects.toBeInstanceOf(AuthorizationError)
    expect(gateway.statusLookups).toHaveLength(1)
  })

  test('counts only authorized pending deliveries when the provider has no status lookup', async () => {
    const application = new SchoolApplication({ repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    expect(await reconcilePendingDeliveries({ asOf, actor, service: application.forActor(actor) })).toEqual({ processed: 0, skipped: 1 })
  })
})
