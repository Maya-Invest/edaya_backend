import type { ClaimedDurableWork } from '@edaya/core'
import type { CronJobDispatcherPort, CronOccurrence } from '../../ports/platform'
import type { SchoolApplication } from '../../services/school-application'
import { CRON_JOB_KEYS } from './cron-job-catalog'
import { runCronJobForSchool } from './cron-job-runner'
import { DurableWorkFailure, runDurableWorkBatch } from './durable-work'

export type DurableCronApplication = Pick<SchoolApplication, 'repositories' | 'forActor' | 'atomicExecution' | 'commandExecution' | 'durableWork'>
export const CRON_EXECUTE_KIND = 'cron.execute'
export const CRON_DISPATCH_KIND = 'cron.dispatch'
export const cronExecutionId = (occurrenceId: string): string => `cron-execute:${occurrenceId}`

async function loadOccurrence(application: DurableCronApplication, work: ClaimedDurableWork): Promise<CronOccurrence> {
  if (work.version !== 1 || work.resourceType !== 'cron-occurrence')
    throw new DurableWorkFailure('CRON_VERSION_UNSUPPORTED', true)
  const occurrence = await application.repositories.cronJobSchedules.findOccurrence(work.resourceId)
  if (!occurrence || occurrence.schoolId !== work.schoolId)
    throw new DurableWorkFailure('CRON_OCCURRENCE_INVALID', true)
  if (occurrence.version !== 1 || !CRON_JOB_KEYS.includes(occurrence.jobKey))
    throw new DurableWorkFailure('CRON_VERSION_UNSUPPORTED', true)
  if (!await application.repositories.schools.findById(occurrence.schoolId))
    throw new DurableWorkFailure('CRON_SCHOOL_UNAVAILABLE', true)
  return occurrence
}

/** Provider calls happen after the occurrence and its work have committed. */
export async function dispatchCronOccurrences(application: DurableCronApplication, dispatcher: CronJobDispatcherPort) {
  await application.repositories.cronJobSchedules.recoverDeliveries()
  const dispatches: { jobId: string }[] = []
  const delivery = await runDurableWorkBatch(application.durableWork, {
    [CRON_DISPATCH_KIND]: {
      version: 1,
      run: async (work) => {
        const occurrence = await loadOccurrence(application, work)
        const message = { jobId: cronExecutionId(occurrence.id) }
        await dispatcher.dispatch(message)
        dispatches.push(message)
      },
    },
  })
  return { dispatches, delivery }
}

/** Queue data supplies a reference only. Effects and completion share one transaction. */
export async function executeCronOccurrence(application: DurableCronApplication, jobId: string): Promise<'ack' | 'retry'> {
  const [work] = await application.durableWork.claim({ kinds: [CRON_EXECUTE_KIND], jobId, limit: 1, leaseMs: 60000 })
  if (work) {
    try {
      await application.atomicExecution.execute(async () => {
        const occurrence = await loadOccurrence(application, work)
        if (work.id !== cronExecutionId(occurrence.id))
          throw new DurableWorkFailure('CRON_OCCURRENCE_INVALID', true)
        await runCronJobForSchool(application, occurrence)
        if (!await application.durableWork.complete(work))
          throw new DurableWorkFailure('CRON_LEASE_LOST')
      })
    }
    catch (error) {
      await application.durableWork.fail(work, {
        code: error instanceof DurableWorkFailure ? error.code : 'CRON_EXECUTION_FAILED',
        permanent: error instanceof DurableWorkFailure && error.permanent,
      })
    }
  }
  const state = await application.durableWork.getState(jobId)
  return !state || state.status === 'completed' || state.status === 'dead' ? 'ack' : 'retry'
}
