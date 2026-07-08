import type { CronJobKey } from '../../capabilities/scheduling-jobs/cron-job-catalog'

export interface CronJobSchedule {
  readonly id: string
  readonly jobKey: CronJobKey
  readonly cronExpression: string
  readonly enabled: boolean
  readonly nextRunAt: Date
  readonly lastDispatchedAt: Date | null
}

export interface CronJobSchedulePort {
  listDue: (asOf: Date) => Promise<readonly CronJobSchedule[]>
  markDispatched: (
    id: string,
    input: { nextRunAt: Date, dispatchedAt: Date },
  ) => Promise<void>
}
