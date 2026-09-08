import type { AnnouncementPriority, NotificationEnqueueInput, NotificationGatewayPort, NotificationKind, NotificationRecipient } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import { MessageDelivery } from '@edaya/core'
import { resolveRecipientSubjectId, uniqueNotificationRecipients } from './recipient-utils'

export function buildNotificationDeliveryId(sourceKey: string, subjectId: string): string {
  return `delivery:${sourceKey}:${subjectId}`
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
    const subjectId = recipient.subjectId ?? await resolveRecipientSubjectId(deps.repositories, recipient)
    if (!subjectId) {
      continue
    }

    const deliveryId = buildNotificationDeliveryId(input.idempotencyKeyPrefix, subjectId)
    const existing = await deps.repositories.messageDeliveries.findById(deliveryId)
    if (!existing) {
      await deps.repositories.messageDeliveries.save(new MessageDelivery({
        id: deliveryId,
        schoolId: input.schoolId,
        announcementId: input.announcementId,
        eventKey: input.announcementId ? undefined : input.eventKey,
        subjectId,
        recipientKind: recipient.kind,
        recipientId: recipient.id,
        title: input.title,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      }))
    }

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
  idempotencyKeyPrefix: string,
  recipients: readonly NotificationRecipient[],
): Promise<void> {
  for (const recipient of uniqueNotificationRecipients(recipients)) {
    const subjectId = recipient.subjectId ?? await resolveRecipientSubjectId(deps.repositories, recipient)
    if (!subjectId) {
      continue
    }
    await deps.notificationGateway.cancel(buildNotificationDeliveryId(idempotencyKeyPrefix, subjectId))
  }
}
