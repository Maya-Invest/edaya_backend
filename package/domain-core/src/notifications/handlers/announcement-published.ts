import type { Announcement, MessageDelivery } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'

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

  for (const delivery of deliveries) {
    if (!delivery.recipientKind || !delivery.recipientId) {
      continue
    }
    await context.notificationGateway.enqueue({
      idempotencyKey: delivery.id,
      schoolId: announcement.schoolId,
      kind: 'ad_hoc',
      eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
      announcementId: announcement.id,
      title: announcement.title,
      body: announcement.content,
      recipients: [{
        kind: delivery.recipientKind,
        id: delivery.recipientId,
        subjectId: delivery.subjectId,
      }],
      priority: announcement.priority,
      premium: announcement.premiumNotification,
      metadata: {
        deliveryId: delivery.id,
      },
    })
  }
}
