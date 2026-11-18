import { Activity, ActivityCategory, ClassActivityEnrollment, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  ACTIVITY_REMINDER_EVENT_KEY,
} from '../../src/capabilities/notifications/triggers/activity-reminder'
import { scanActivityReminders } from '../../src/capabilities/scheduling-jobs/jobs/scan-activity-reminders'
import { createReminderCronContext } from '../support/reminder-scan-fixtures'

const asOfInWindow = new Date('2026-06-19T12:00:00.000Z')
const reminderStartDate = new Date('2026-06-20T00:00:00.000Z')
const reminderEndDate = new Date('2026-06-30T00:00:00.000Z')

function schoolActivity(overrides: Partial<ConstructorParameters<typeof Activity>[0]> = {}) {
  return new Activity(withShortName({
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
  }))
}

describe('scanActivityReminders', () => {
  test('enqueues reminders for in-window activities with approved enrollments', async () => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      activities: [schoolActivity()],
    })

    const schedules = context.service.baseService.repositories.cronJobSchedules
    expect(await schedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual(['school-1'])
    const result = await scanActivityReminders(context)
    expect(await schedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual([])

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
    const guardians = context.service.baseService.repositories.guardians
    const guardian = await guardians.findById('gua1')
    await guardians.save(guardian!.copyWith({ subjectId: 'new-guardian-login' }))
    expect(await schedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual(['school-1'])
  })

  test.each([false, true])('finds class-assigned recipients once (individual enrollment: %s)', async (hasIndividualEnrollment) => {
    const { context, gateway } = await createReminderCronContext({
      asOf: asOfInWindow,
      activities: [schoolActivity()],
    })
    const repositories = context.service.baseService.repositories
    if (!hasIndividualEnrollment)
      await repositories.activityEnrollments.delete('enrollment-act1')
    await repositories.classActivityEnrollments.save(new ClassActivityEnrollment({
      id: 'class-placement',
      activityId: 'act1',
      classGroupId: 'cg1',
    }))

    const schedules = repositories.cronJobSchedules
    expect(await schedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual(['school-1'])
    expect(await scanActivityReminders(context)).toEqual({ processed: 1, skipped: 0 })
    expect(gateway.enqueued.flatMap(job => job.recipients.map(row => row.id)).sort()).toEqual(['gua1', 'stu1'])
    expect(await schedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual([])
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

    expect(await context.service.baseService.repositories.cronJobSchedules.listDueSchoolIds('processDueNotifications', context.asOf)).toEqual([])
    const result = await scanActivityReminders(context)

    expect(result).toEqual({ processed: 0, skipped: 2 })
    expect(gateway.enqueued).toHaveLength(0)
  })
})
