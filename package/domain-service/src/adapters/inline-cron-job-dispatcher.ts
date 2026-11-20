import type { DurableCronApplication } from '../capabilities/scheduling-jobs/durable-cron'
import type { CronJobDispatcherPort } from '../ports/platform'
import { executeCronOccurrence } from '../capabilities/scheduling-jobs/durable-cron'
import { DurableWorkFailure } from '../capabilities/scheduling-jobs/durable-work'

export function createInlineCronJobDispatcher(application: DurableCronApplication): CronJobDispatcherPort {
  return {
    dispatch: async ({ jobId }) => {
      if (await executeCronOccurrence(application, jobId) === 'retry')
        throw new DurableWorkFailure('CRON_EXECUTION_PENDING')
    },
  }
}
