import type { Announcement, MessageDelivery } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { uniqueNotificationRecipients } from '../recipient-utils'

export const ANNOUNCEMENT_PUBLISHED_EVENT_KEY = 'announcement.published'

export interface AnnouncementPublishedPayload {
  announcement: Announcement
  deliveries: MessageDelivery[]
}

export async function handleAnnouncementPublished(
  context: WorkflowNotificationContext,
  payload: AnnouncementPublishedPayload,
): Promise<void> {
  const { announcement, deliveries } = payload
  if (deliveries.length === 0 || announcement.schoolId !== context.actor.schoolId) {
    return
  }

  const recipients = uniqueNotificationRecipients(deliveries.map(delivery => ({
    kind: delivery.recipientKind,
    id: delivery.recipientId,
  })))
  const channels = [...new Set(deliveries.map(delivery => delivery.channel))]

  await context.notificationGateway.enqueue({
    idempotencyKey: `${ANNOUNCEMENT_PUBLISHED_EVENT_KEY}:${announcement.id}`,
    schoolId: announcement.schoolId,
    kind: 'ad_hoc',
    eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
    announcementId: announcement.id,
    title: announcement.title,
    body: announcement.content,
    recipients,
    channels,
    priority: announcement.priority,
    premium: announcement.premiumNotification,
  })
}
