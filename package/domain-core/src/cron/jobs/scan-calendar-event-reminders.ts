import type { CalendarEvent } from '../../domains'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { CalendarEventKind } from '../../domains'
import { resolveCalendarEventRecipients } from '../../notifications/recipient-resolvers'
import {
  CALENDAR_EVENT_REMINDER_EVENT_KEY,
  calendarEventReminderDeliverAfter,
  calendarEventReminderIdempotencyKey,
} from '../../notifications/triggers/calendar-event-reminder'
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

    await context.service.baseService.notificationGateway.enqueue({
      idempotencyKey: calendarEventReminderIdempotencyKey(event.id),
      schoolId: event.schoolId,
      kind: 'job',
      eventKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      title: `Upcoming event: ${event.title}`,
      body: `${event.title} starts on ${event.startDate.toISOString().slice(0, 10)}.`,
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
