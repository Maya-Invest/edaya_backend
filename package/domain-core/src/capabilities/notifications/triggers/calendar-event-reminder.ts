import type { CalendarEvent } from '../../domains'
import type { NotificationTriggerRegistration } from '../notification-trigger-registry'
import { CalendarEventKind } from '../../domains'
import { resolveCalendarEventRecipients } from '../recipient-resolvers'
import {
  formatNotificationDate,
  formatNotificationDateRange,
} from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveCalendarEventScopeLabel } from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

export const CALENDAR_EVENT_REMINDER_EVENT_KEY = 'calendar.event_reminder'
export const CALENDAR_EVENT_REMINDER_LEAD_HOURS = 24

export function calendarEventReminderIdempotencyKey(eventId: string): string {
  return `${CALENDAR_EVENT_REMINDER_EVENT_KEY}:${eventId}`
}

export function calendarEventReminderDeliverAfter(startDate: Date): Date {
  const deliverAfter = new Date(startDate)
  deliverAfter.setUTCHours(deliverAfter.getUTCHours() - CALENDAR_EVENT_REMINDER_LEAD_HOURS)
  return deliverAfter
}

export function calendarEventReminderPredicate(
  entity: CalendarEvent,
  existing: CalendarEvent | undefined,
): boolean {
  if (entity.kind !== CalendarEventKind.Event) {
    return false
  }
  if (!existing) {
    return true
  }
  return entity.startDate.getTime() !== existing.startDate.getTime()
    || entity.endDate.getTime() !== existing.endDate.getTime()
    || entity.kind !== existing.kind
    || entity.scopeKind !== existing.scopeKind
    || entity.scopeId !== existing.scopeId
}

export const calendarEventReminderTrigger: NotificationTriggerRegistration<CalendarEvent> = {
  entityKey: 'calendarEvents',
  predicate: calendarEventReminderPredicate,
  resolver: async (entity, existing, context) => {
    const idempotencyKey = calendarEventReminderIdempotencyKey(entity.id)

    if (entity.kind !== CalendarEventKind.Event) {
      await context.notificationGateway.cancel(idempotencyKey)
      return null
    }

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
      && existing.kind === entity.kind
      && existing.scopeKind === entity.scopeKind
      && existing.scopeId === entity.scopeId
    ) {
      return null
    }

    const recipients = await resolveCalendarEventRecipients(context.repositories, entity)
    if (recipients.length === 0) {
      return null
    }

    const { schoolName, timeZone } = await resolveSchoolContext(context.repositories, entity.schoolId)
    const scopeLabel = await resolveCalendarEventScopeLabel(context.repositories, entity)
    const dateRange = formatNotificationDateRange(entity.startDate, entity.endDate, timeZone)
    const content = await renderNotificationEnqueueContent(context.templateService, {
      schoolId: entity.schoolId,
      templateKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      variables: {
        schoolName,
        eventTitle: entity.title,
        startDate: formatNotificationDate(entity.startDate, timeZone),
        endDate: formatNotificationDate(entity.endDate, timeZone),
        dateRange,
        scopeLabel,
      },
    })

    return {
      idempotencyKey,
      schoolId: entity.schoolId,
      kind: 'job',
      eventKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      ...content,
      recipients,
      deliverAfter: calendarEventReminderDeliverAfter(entity.startDate),
      metadata: {
        calendarEventId: entity.id,
        scopeKind: entity.scopeKind,
        scopeId: entity.scopeId ?? '',
      },
    }
  },
}
