import type { SchoolApplication } from '../services/school-application'
import type { CronJobKey } from './cron-job-catalog'
import type { CronJobResult, SchoolCronJobContext } from './cron-job-context'
import { createSystemActorMetadata } from '../authorization'
import { CRON_JOB_KEYS } from './cron-job-catalog'
import { processDueNotifications } from './jobs/process-due-notifications'
import { reconcilePendingDeliveries } from './jobs/reconcile-pending-deliveries'

export interface CronJobSchoolResult {
  schoolId: string
  jobKey: CronJobKey
  result: CronJobResult
}

export interface CronJobRunSummary {
  readonly asOf: Date
  readonly results: CronJobSchoolResult[]
}

const CRON_JOB_HANDLERS = {
  processDueNotifications,
  reconcilePendingDeliveries,
} as const satisfies Record<CronJobKey, (context: SchoolCronJobContext) => Promise<CronJobResult>>

export async function runCronJobs(
  application: SchoolApplication,
  options: {
    asOf: Date
    jobKeys?: readonly CronJobKey[]
    requestIdPrefix?: string
  },
): Promise<CronJobRunSummary> {
  const jobKeys = options.jobKeys ?? CRON_JOB_KEYS
  const schools = await application.repositories.schools.list()
  const results: CronJobSchoolResult[] = []

  for (const school of schools) {
    const actor = createSystemActorMetadata({
      systemId: 'cron',
      schoolId: school.id,
      requestId: `${options.requestIdPrefix ?? 'cron'}:${school.id}:${options.asOf.toISOString()}`,
      reason: 'scheduled cron job',
    })
    const service = application.forActor(actor)
    const context: SchoolCronJobContext = {
      asOf: options.asOf,
      actor,
      service,
    }

    for (const jobKey of jobKeys) {
      const result = await CRON_JOB_HANDLERS[jobKey](context)
      results.push({ schoolId: school.id, jobKey, result })
    }
  }

  return {
    asOf: options.asOf,
    results,
  }
}
