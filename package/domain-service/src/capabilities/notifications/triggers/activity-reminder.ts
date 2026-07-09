import type { Activity } from '@edaya/core'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { resolveActivityEnrollmentRecipients } from '../delivery/recipient-resolvers'
import {
  formatNotificationDate,
  formatNotificationDateRange,
} from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolContext } from '../templates/resolve-school-context'

export const ACTIVITY_REMINDER_EVENT_KEY = 'activity.reminder'
export const ACTIVITY_REMINDER_LEAD_HOURS = 24

export function activityReminderIdempotencyKey(activityId: string): string {
  return `${ACTIVITY_REMINDER_EVENT_KEY}:${activityId}`
}

export function activityReminderDeliverAfter(startDate: Date): Date {
  const deliverAfter = new Date(startDate)
  deliverAfter.setUTCHours(deliverAfter.getUTCHours() - ACTIVITY_REMINDER_LEAD_HOURS)
  return deliverAfter
}

export function activityReminderPredicate(
  entity: Activity,
  existing: Activity | undefined,
): boolean {
  if (!existing) {
    return true
  }
  return entity.startDate.getTime() !== existing.startDate.getTime()
    || entity.endDate.getTime() !== existing.endDate.getTime()
}

export const activityReminderTrigger: NotificationTriggerRegistration<Activity> = {
  entityKey: 'activities',
  predicate: activityReminderPredicate,
  resolver: async (entity, existing, context) => {
    const idempotencyKey = activityReminderIdempotencyKey(entity.id)

    if (entity.schoolId !== context.actor.schoolId) {
      return null
    }

    if (entity.endDate.getTime() < Date.now()) {
      await context.notificationGateway.cancel(idempotencyKey)
      return null
    }

    if (
      existing
      && existing.startDate.getTime() === entity.startDate.getTime()
      && existing.endDate.getTime() === entity.endDate.getTime()
    ) {
      return null
    }

    const recipients = await resolveActivityEnrollmentRecipients(
      context.repositories,
      entity.schoolId,
      entity.id,
    )
    if (recipients.length === 0) {
      return null
    }

    const { schoolName, timeZone } = await resolveSchoolContext(context.repositories, entity.schoolId)
    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: entity.schoolId,
      templateKey: ACTIVITY_REMINDER_EVENT_KEY,
      variables: {
        schoolName,
        activityName: entity.name,
        startDate: formatNotificationDate(entity.startDate, timeZone),
        endDate: formatNotificationDate(entity.endDate, timeZone),
        dateRange: formatNotificationDateRange(entity.startDate, entity.endDate, timeZone),
        activitySchedule: entity.schedule,
        coachName: entity.coach,
        activityCategory: entity.category,
      },
    })

    return {
      idempotencyKey,
      schoolId: entity.schoolId,
      kind: 'job',
      eventKey: ACTIVITY_REMINDER_EVENT_KEY,
      ...content,
      recipients,
      deliverAfter: activityReminderDeliverAfter(entity.startDate),
      metadata: {
        activityId: entity.id,
      },
    }
  },
}
