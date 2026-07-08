import type { CronJobDispatcherPort, CronJobDispatchMessage, CronJobSchedulePort } from '../../ports/platform'

export interface CronHeartbeatSummary {
  readonly asOf: Date
  readonly dispatches: readonly CronJobDispatchMessage[]
}

export async function tickCronSchedules(
  deps: {
    schedules: CronJobSchedulePort
    dispatcher: CronJobDispatcherPort
    listSchoolIds: () => Promise<readonly string[]>
    computeNextRunAt: (cronExpression: string, after: Date) => Date
  },
  options: {
    asOf: Date
    requestIdPrefix: string
  },
): Promise<CronHeartbeatSummary> {
  const dueSchedules = await deps.schedules.listDue(options.asOf)
  const schoolIds = await deps.listSchoolIds()
  const dispatches: CronJobDispatchMessage[] = []

  for (const schedule of dueSchedules) {
    for (const schoolId of schoolIds) {
      const message: CronJobDispatchMessage = {
        jobKey: schedule.jobKey,
        schoolId,
        asOf: options.asOf,
        requestId: `${options.requestIdPrefix}:${schedule.jobKey}:${schoolId}:${options.asOf.toISOString()}`,
      }
      await deps.dispatcher.dispatch(message)
      dispatches.push(message)
    }

    await deps.schedules.markDispatched(schedule.id, {
      nextRunAt: deps.computeNextRunAt(schedule.cronExpression, options.asOf),
      dispatchedAt: options.asOf,
    })
  }

  return {
    asOf: options.asOf,
    dispatches,
  }
}
