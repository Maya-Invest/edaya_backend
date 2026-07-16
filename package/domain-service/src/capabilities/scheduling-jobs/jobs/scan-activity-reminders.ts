import type { Activity } from '@edaya/core'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { enqueueTemplatedNotification } from '../../../capabilities/notifications/templates/enqueue-templated-notification'
import { resolveSchoolName } from '../../../capabilities/notifications/templates/resolve-school-name'
import {
  ACTIVITY_REMINDER_EVENT_KEY,
  activityReminderDeliverAfter,
  activityReminderIdempotencyKey,
} from '../../../capabilities/notifications/triggers/activity-reminder'
import { resolveActivityEnrollmentRecipients } from '../../notifications/delivery/recipient-resolvers'
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

    const schoolName = await resolveSchoolName(
      context.service.baseService.repositories,
      activity.schoolId,
    )
    await enqueueTemplatedNotification(context.service.baseService, {
      idempotencyKey: activityReminderIdempotencyKey(activity.id),
      schoolId: activity.schoolId,
      kind: 'job',
      eventKey: ACTIVITY_REMINDER_EVENT_KEY,
      templateKey: ACTIVITY_REMINDER_EVENT_KEY,
      variables: {
        schoolName,
        activityName: activity.name,
        startDate: activity.startDate.toISOString().slice(0, 10),
      },
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

function shouldNotifyActivityReminder(activity: Activity, asOf: Date): boolean {
  if (activity.endDate.getTime() < asOf.getTime()) {
    return false
  }
  return isInJobNotificationWindow(
    activityReminderDeliverAfter(activity.startDate),
    activity.startDate,
    asOf,
  )
}
