import type { ExtracurricularActivity } from '../../domains'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { resolveActivityEnrollmentRecipients } from '../../notifications/recipient-resolvers'
import {
  ACTIVITY_REMINDER_EVENT_KEY,
  activityReminderDeliverAfter,
  activityReminderIdempotencyKey,
} from '../../notifications/triggers/activity-reminder'
import { isInJobNotificationWindow } from '../due-window'

export async function scanActivityReminders(
  context: SchoolCronJobContext,
): Promise<CronJobResult> {
  const activities = await context.service.baseService.repositories.activities.list({})
  let processed = 0
  let skipped = 0

  for (const activity of activities) {
    if (!shouldNotifyActivityReminder(activity, context.asOf)) {
      skipped += 1
      continue
    }

    if (activity.schoolId !== context.actor.schoolId) {
      skipped += 1
      continue
    }

    const recipients = await resolveActivityEnrollmentRecipients(
      context.service.baseService.repositories,
      activity.schoolId,
      activity.id,
    )
    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    await context.service.baseService.notificationGateway.enqueue({
      idempotencyKey: activityReminderIdempotencyKey(activity.id),
      schoolId: activity.schoolId,
      kind: 'job',
      eventKey: ACTIVITY_REMINDER_EVENT_KEY,
      title: `Activity starting soon: ${activity.name}`,
      body: `${activity.name} starts on ${activity.startDate.toISOString().slice(0, 10)}.`,
      recipients,
      deliverAfter: activityReminderDeliverAfter(activity.startDate),
      metadata: {
        activityId: activity.id,
      },
    })
    processed += 1
  }

  return { processed, skipped }
}

function shouldNotifyActivityReminder(activity: ExtracurricularActivity, asOf: Date): boolean {
  if (activity.endDate.getTime() < asOf.getTime()) {
    return false
  }
  return isInJobNotificationWindow(
    activityReminderDeliverAfter(activity.startDate),
    activity.startDate,
    asOf,
  )
}
