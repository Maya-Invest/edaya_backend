import { describe, expect, test } from 'bun:test'
import {
  ACTIVITY_REMINDER_EVENT_KEY,
} from '../../src/capabilities/notifications/triggers/activity-reminder'
import { scanActivityReminders } from '../../src/capabilities/scheduling-jobs/jobs/scan-activity-reminders'
import { Activity, ActivityCategory } from '../../src/domain'
import { createReminderCronContext } from '../support/reminder-scan-fixtures'

const asOfInWindow = new Date('2026-06-19T12:00:00.000Z')
const reminderStartDate = new Date('2026-06-20T00:00:00.000Z')
const reminderEndDate = new Date('2026-06-30T00:00:00.000Z')

function schoolActivity(overrides: Partial<ConstructorParameters<typeof Activity>[0]> = {}) {
  return new Activity({
    id: 'act1',
    schoolId: 'school-1',
    name: 'Basketball club',
    category: ActivityCategory.Sport,
    coach: 'Coach Dupont',
    schedule: 'Tuesdays 4–6pm',
    participants: 10,
    capacity: 20,
    description: 'Weekly practice',
    startDate: reminderStartDate,
    endDate: reminderEndDate,
    ...overrides,
  })
}

describe('scanActivityReminders', () => {
  test('enqueues reminders for in-window activities with approved enrollments', async () => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      activities: [schoolActivity()],
    })

    const result = await scanActivityReminders(context)

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(gateway.enqueued.length).toBeGreaterThan(0)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: ACTIVITY_REMINDER_EVENT_KEY,
      schoolId: 'school-1',
      metadata: {
        activityId: 'act1',
      },
    })
    expect(gateway.enqueued[0]?.title).toContain('Basketball club')
  })

  test('skips expired activities, other schools, and activities outside the reminder window', async () => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      activities: [
        schoolActivity({
          id: 'act-expired',
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          endDate: new Date('2026-06-18T00:00:00.000Z'),
        }),
        schoolActivity({
          id: 'act-other-school',
          schoolId: 'school-2',
        }),
        schoolActivity({
          id: 'act-too-early',
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ],
    })

    const result = await scanActivityReminders(context)

    expect(result).toEqual({ processed: 0, skipped: 3 })
    expect(gateway.enqueued).toHaveLength(0)
  })
})
