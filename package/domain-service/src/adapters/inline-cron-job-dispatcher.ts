import type { CronApplication } from '../capabilities/scheduling-jobs/cron-job-runner'
import type { CronJobDispatcherPort, CronJobDispatchMessage } from '../ports/platform'
import { runCronJobForSchool } from '../capabilities/scheduling-jobs/cron-job-runner'

export function createInlineCronJobDispatcher(application: CronApplication): CronJobDispatcherPort {
  return {
    dispatch: async (message: CronJobDispatchMessage) => {
      await runCronJobForSchool(application, {
        jobKey: message.jobKey,
        schoolId: message.schoolId,
        asOf: message.asOf,
        requestId: message.requestId,
      })
    },
  }
}
