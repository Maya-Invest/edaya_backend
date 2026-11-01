import type { CronJobKey } from '../../capabilities/scheduling-jobs/cron-job-catalog'

export interface CronJobSchedule {
  readonly id: string
  readonly jobKey: CronJobKey
  readonly cronExpression: string
  readonly enabled: boolean
  readonly nextRunAt: Date
  readonly lastDispatchedAt: Date | null
}

export interface CronOccurrence {
  readonly id: string
  readonly schoolId: string
  readonly scheduleId: string
  readonly jobKey: CronJobKey
  readonly version: number
  readonly scheduledFor: Date
  readonly asOf: Date
  readonly requestId: string
}

export interface CronJobSchedulePort {
  /** Re-arm accepted deliveries whose execution is still due, preserving retry budgets. */
  recoverDeliveries: () => Promise<void>
  findById: (id: string) => Promise<CronJobSchedule | null>
  saveOccurrence: (occurrence: CronOccurrence) => Promise<void>
  findOccurrence: (id: string) => Promise<CronOccurrence | null>
  listDue: (asOf: Date) => Promise<readonly CronJobSchedule[]>
  markDispatched: (
    id: string,
    input: { nextRunAt: Date, dispatchedAt: Date },
  ) => Promise<void>
}
