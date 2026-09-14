import type { AnnouncementPriority, NotificationEnqueueInput, NotificationGatewayPort, NotificationKind, NotificationRecipient } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import { AccessPolicies, createSystemActorMetadata } from '@edaya/authorization'
import { MessageDelivery } from '@edaya/core'
import { resolveRecipientSubjectId, uniqueNotificationRecipients } from './recipient-utils'

export function buildNotificationDeliveryId(schoolId: string, sourceKey: string, subjectId: string, recipient: Pick<NotificationRecipient, 'kind' | 'id'>): string {
  return `delivery:v2:${[schoolId, sourceKey, subjectId, recipient.kind, recipient.id].map(encodeURIComponent).join(':')}`
}

export interface DeliverNotificationDeps {
  notificationGateway: NotificationGatewayPort
  repositories: SchoolRepositories
}

export interface DeliverNotificationInput {
  schoolId: string
  kind: NotificationKind
  eventKey: string
  idempotencyKeyPrefix: string
  title: string
  body: string
  emailSubject?: string
  emailBody?: string
  recipients: readonly NotificationRecipient[]
  announcementId?: string
  priority?: AnnouncementPriority
  deliverAfter?: Date
  metadata?: Record<string, string>
}

export async function deliverNotification(
  deps: DeliverNotificationDeps,
  input: DeliverNotificationInput,
): Promise<void> {
  const now = new Date()
  for (const recipient of uniqueNotificationRecipients(input.recipients)) {
    const subjectId = await resolveRecipientSubjectId(deps.repositories, recipient)
    if (!subjectId || (recipient.subjectId && recipient.subjectId !== subjectId)) {
      continue
    }

    const access = new AccessPolicies(createSystemActorMetadata({
      systemId: 'notify-adapter',
      schoolId: input.schoolId,
      requestId: input.idempotencyKeyPrefix,
      reason: input.eventKey,
    }), deps.repositories)
    const repository = deps.repositories.messageDeliveries.forAccess(await access.entity('messageDeliveries').readScope())
    const existing = (await repository.list({
      sourceKey: input.idempotencyKeyPrefix,
      subjectId,
      recipientKind: recipient.kind,
      recipientId: recipient.id,
      $limit: 1,
    }))[0]
    const deliveryId = existing?.id ?? buildNotificationDeliveryId(input.schoolId, input.idempotencyKeyPrefix, subjectId, recipient)
    const delivery = new MessageDelivery({
      id: deliveryId,
      schoolId: input.schoolId,
      announcementId: input.announcementId,
      eventKey: input.announcementId ? undefined : input.eventKey,
      sourceKey: input.idempotencyKeyPrefix,
      subjectId,
      recipientKind: recipient.kind,
      recipientId: recipient.id,
      title: input.title,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    })
    const scope = await access.entity('messageDeliveries').assertSave(delivery, existing)
    if (!existing)
      await deps.repositories.messageDeliveries.forAccess(scope).save(delivery)

    await deps.notificationGateway.enqueue({
      idempotencyKey: deliveryId,
      schoolId: input.schoolId,
      kind: input.kind,
      eventKey: input.eventKey,
      announcementId: input.announcementId,
      title: input.title,
      body: input.body,
      emailSubject: input.emailSubject,
      emailBody: input.emailBody,
      recipients: [{
        kind: recipient.kind,
        id: recipient.id,
        subjectId,
      }],
      priority: input.priority,
      deliverAfter: input.deliverAfter,
      metadata: {
        ...input.metadata,
        deliveryId,
      },
    })
  }
}

export async function deliverNotificationFromEnqueueInput(
  deps: DeliverNotificationDeps,
  input: NotificationEnqueueInput,
): Promise<void> {
  await deliverNotification(deps, {
    schoolId: input.schoolId,
    kind: input.kind,
    eventKey: input.eventKey,
    idempotencyKeyPrefix: input.idempotencyKey,
    title: input.title,
    body: input.body,
    emailSubject: input.emailSubject,
    emailBody: input.emailBody,
    recipients: input.recipients,
    announcementId: input.announcementId,
    priority: input.priority,
    deliverAfter: input.deliverAfter,
    metadata: input.metadata,
  })
}

export async function cancelNotificationDeliveries(
  deps: DeliverNotificationDeps,
  schoolId: string,
  sourceKey: string,
): Promise<void> {
  const access = new AccessPolicies(createSystemActorMetadata({
    systemId: 'notify-adapter',
    schoolId,
    requestId: `cancel:${sourceKey}`,
    reason: 'Cancel notification source',
  }), deps.repositories)
  const scope = await access.entity('messageDeliveries').readScope()
  const deliveries = await deps.repositories.messageDeliveries.forAccess(scope).list({ sourceKey })
  for (const delivery of deliveries)
    await deps.notificationGateway.cancel(delivery.id, schoolId)
}
