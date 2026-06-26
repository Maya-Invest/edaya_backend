import type { Announcement, MessageDelivery } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolName } from '../templates/resolve-school-name'

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

  const schoolName = await resolveSchoolName(context.repositories, announcement.schoolId)
  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: announcement.schoolId,
    templateKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
    variables: {
      schoolName,
      announcementTitle: announcement.title,
      announcementBody: announcement.content,
    },
  })

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
      ...content,
      recipients: [{
        kind: delivery.recipientKind,
        id: delivery.recipientId,
        subjectId: delivery.subjectId,
      }],
      priority: announcement.priority,
      metadata: {
        deliveryId: delivery.id,
      },
    })
  }
}
