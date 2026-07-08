import type { CronJobKey } from '../../capabilities/scheduling-jobs/cron-job-catalog'

export interface CronJobDispatchMessage {
  readonly jobKey: CronJobKey
  readonly schoolId: string
  readonly asOf: Date
  readonly requestId: string
}

export interface CronJobDispatcherPort {
  dispatch: (message: CronJobDispatchMessage) => Promise<void>
}
