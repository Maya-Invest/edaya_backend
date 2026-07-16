import { CalendarEvent, CalendarEventKind, CalendarEventScopeKind } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  CALENDAR_EVENT_REMINDER_EVENT_KEY,
} from '../../src/capabilities/notifications/triggers/calendar-event-reminder'
import { scanCalendarEventReminders } from '../../src/capabilities/scheduling-jobs/jobs/scan-calendar-event-reminders'
import { createReminderCronContext } from '../support/reminder-scan-fixtures'

const asOfInWindow = new Date('2026-06-19T12:00:00.000Z')
const reminderStartDate = new Date('2026-06-20T00:00:00.000Z')
const reminderEndDate = new Date('2026-06-22T00:00:00.000Z')

function classGroupEvent(overrides: Partial<ConstructorParameters<typeof CalendarEvent>[0]> = {}) {
  return new CalendarEvent({
    id: 'evt1',
    schoolId: 'school-1',
    academicYearId: 'y1',
    title: 'Science fair',
    description: 'Annual fair',
    startDate: reminderStartDate,
    endDate: reminderEndDate,
    kind: CalendarEventKind.Event,
    scopeKind: CalendarEventScopeKind.ClassGroup,
    scopeId: 'cg1',
    ...overrides,
  })
}

describe('scanCalendarEventReminders', () => {
  test('enqueues reminders for in-window class group events with recipients', async () => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      calendarEvents: [classGroupEvent()],
    })

    const result = await scanCalendarEventReminders(context)

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(gateway.enqueued.length).toBeGreaterThan(0)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: CALENDAR_EVENT_REMINDER_EVENT_KEY,
      schoolId: 'school-1',
      metadata: {
        calendarEventId: 'evt1',
        scopeKind: CalendarEventScopeKind.ClassGroup,
        scopeId: 'cg1',
      },
    })
    expect(gateway.enqueued[0]?.title).toContain('Science fair')
  })

  test('skips holidays, expired events, other schools, and events without recipients', async () => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      calendarEvents: [
        classGroupEvent({ id: 'evt-holiday', kind: CalendarEventKind.Holiday, scopeKind: CalendarEventScopeKind.School, scopeId: undefined }),
        classGroupEvent({
          id: 'evt-expired',
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          endDate: new Date('2026-06-18T00:00:00.000Z'),
        }),
        classGroupEvent({
          id: 'evt-other-school',
          schoolId: 'school-2',
        }),
        classGroupEvent({
          id: 'evt-school-scope',
          scopeKind: CalendarEventScopeKind.School,
          scopeId: undefined,
        }),
        classGroupEvent({
          id: 'evt-too-early',
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-07-03T00:00:00.000Z'),
        }),
      ],
    })

    const result = await scanCalendarEventReminders(context)

    expect(result).toEqual({ processed: 0, skipped: 5 })
    expect(gateway.enqueued).toHaveLength(0)
  })
})
