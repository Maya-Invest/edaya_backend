import type { CalendarEvent } from '../../../domain'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { CalendarEventKind } from '../../../domain'
import { resolveCalendarEventRecipients } from '../../notifications/delivery/recipient-resolvers'
import { enqueueTemplatedNotification } from '../../../capabilities/notifications/templates/enqueue-templated-notification'
import { resolveSchoolName } from '../../../capabilities/notifications/templates/resolve-school-name'
import {
  CALENDAR_EVENT_REMINDER_EVENT_KEY,
  calendarEventReminderDeliverAfter,
  calendarEventReminderIdempotencyKey,
} from '../../../capabilities/notifications/triggers/calendar-event-reminder'
import { isInJobNotificationWindow } from '../due-window'

export async function scanCalendarEventReminders(
  context: SchoolCronJobContext,
): Promise<CronJobResult> {
  const events = await context.service.baseService.repositories.calendarEvents.list({})
  let processed = 0
  let skipped = 0

  for (const event of events) {
    if (!shouldNotifyCalendarEventReminder(event, context.asOf)) {
      skipped += 1
      continue
    }

    if (event.schoolId !== context.actor.schoolId) {
      skipped += 1
      continue
    }

    const recipients = await resolveCalendarEventRecipients(
      context.service.baseService.repositories,
      event,
    )
    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    const schoolName = await resolveSchoolName(
      context.service.baseService.repositories,
      event.schoolId,
    )
    await enqueueTemplatedNotification(context.service.baseService, {
      idempotencyKey: calendarEventReminderIdempotencyKey(event.id),
      schoolId: event.schoolId,
      kind: 'job',
      eventKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      templateKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      variables: {
        schoolName,
        eventTitle: event.title,
        startDate: event.startDate.toISOString().slice(0, 10),
      },
      recipients,
      deliverAfter: calendarEventReminderDeliverAfter(event.startDate),
      metadata: {
        calendarEventId: event.id,
        scopeKind: event.scopeKind,
        scopeId: event.scopeId ?? '',
      },
    })
    processed += 1
  }

  return { processed, skipped }
}

function shouldNotifyCalendarEventReminder(event: CalendarEvent, asOf: Date): boolean {
  if (event.kind !== CalendarEventKind.Event) {
    return false
  }
  if (event.endDate.getTime() < asOf.getTime()) {
    return false
  }
  return isInJobNotificationWindow(
    calendarEventReminderDeliverAfter(event.startDate),
    event.startDate,
    asOf,
  )
}
