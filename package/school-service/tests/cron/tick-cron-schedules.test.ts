import type { CronJobDispatchMessage, CronJobSchedule } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'
import { tickCronSchedules } from '../../src/capabilities/scheduling-jobs/tick-cron-schedules'

describe('tickCronSchedules', () => {
  test('dispatches due schedules for every school and advances next_run_at', async () => {
    const dueSchedule: CronJobSchedule = {
      id: 'schedule-1',
      jobKey: 'reconcilePendingDeliveries',
      cronExpression: '*/5 * * * *',
      enabled: true,
      nextRunAt: new Date('2026-07-03T12:00:00.000Z'),
      lastDispatchedAt: null,
    }
    const markDispatched = mock(async () => {})
    const dispatched: CronJobDispatchMessage[] = []

    const summary = await tickCronSchedules({
      schedules: {
        listDue: mock(async () => [dueSchedule]),
        markDispatched,
      },
      dispatcher: {
        dispatch: mock(async (message) => {
          dispatched.push(message)
        }),
      },
      listSchoolIds: mock(async () => ['school-1', 'school-2']),
      computeNextRunAt: () => new Date('2026-07-03T12:05:00.000Z'),
    }, {
      asOf: new Date('2026-07-03T12:00:00.000Z'),
      requestIdPrefix: 'test-heartbeat',
    })

    expect(summary.dispatches).toHaveLength(2)
    expect(dispatched.map(message => message.schoolId)).toEqual(['school-1', 'school-2'])
    expect(markDispatched).toHaveBeenCalledWith('schedule-1', {
      nextRunAt: new Date('2026-07-03T12:05:00.000Z'),
      dispatchedAt: new Date('2026-07-03T12:00:00.000Z'),
    })
  })

  test('returns an empty summary when nothing is due', async () => {
    const summary = await tickCronSchedules({
      schedules: {
        listDue: mock(async () => []),
        markDispatched: mock(async () => {}),
      },
      dispatcher: {
        dispatch: mock(async () => {}),
      },
      listSchoolIds: mock(async () => ['school-1']),
      computeNextRunAt: () => new Date('2026-07-03T12:05:00.000Z'),
    }, {
      asOf: new Date('2026-07-03T12:00:00.000Z'),
      requestIdPrefix: 'test-heartbeat',
    })

    expect(summary.dispatches).toEqual([])
  })
})
