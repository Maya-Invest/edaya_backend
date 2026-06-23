import type { ExtracurricularActivity } from '../../domains'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { resolveActivityEnrollmentRecipients } from '../recipient-resolvers'

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
  entity: ExtracurricularActivity,
  existing: ExtracurricularActivity | undefined,
): boolean {
  if (!existing) {
    return true
  }
  return entity.startDate.getTime() !== existing.startDate.getTime()
    || entity.endDate.getTime() !== existing.endDate.getTime()
}

export const activityReminderTrigger: NotificationTriggerRegistration<ExtracurricularActivity> = {
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

    return {
      idempotencyKey,
      schoolId: entity.schoolId,
      kind: 'job',
      eventKey: ACTIVITY_REMINDER_EVENT_KEY,
      title: `Activity starting soon: ${entity.name}`,
      body: `${entity.name} starts on ${entity.startDate.toISOString().slice(0, 10)}.`,
      recipients,
      deliverAfter: activityReminderDeliverAfter(entity.startDate),
      metadata: {
        activityId: entity.id,
      },
    }
  },
}
