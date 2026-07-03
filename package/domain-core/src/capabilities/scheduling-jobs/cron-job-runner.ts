import type { SchoolApplication } from '../../application/school-application'
import type { CronJobKey } from './cron-job-catalog'
import type { CronJobResult, SchoolCronJobContext } from './cron-job-context'
import { createSystemActorMetadata } from '../../capabilities/authorization'
import { CRON_JOB_KEYS } from './cron-job-catalog'
import { expireAccountInvitations } from './jobs/expire-account-invitations'
import { processDueNotifications } from './jobs/process-due-notifications'
import { reconcilePendingDeliveries } from './jobs/reconcile-pending-deliveries'

/** Minimal application surface required to run scheduled cron jobs. */
export type CronApplication = Pick<SchoolApplication, 'repositories' | 'forActor'>

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
  expireAccountInvitations,
} as const satisfies Record<CronJobKey, (context: SchoolCronJobContext) => Promise<CronJobResult>>

export async function runCronJobForSchool(
  application: CronApplication,
  options: {
    jobKey: CronJobKey
    schoolId: string
    asOf: Date
    requestId: string
  },
): Promise<CronJobSchoolResult> {
  const actor = createSystemActorMetadata({
    systemId: 'cron',
    schoolId: options.schoolId,
    requestId: options.requestId,
    reason: 'scheduled cron job',
  })
  const service = application.forActor(actor)
  const context: SchoolCronJobContext = {
    asOf: options.asOf,
    actor,
    service,
  }
  const result = await CRON_JOB_HANDLERS[options.jobKey](context)

  return {
    schoolId: options.schoolId,
    jobKey: options.jobKey,
    result,
  }
}

export async function runCronJobs(
  application: CronApplication,
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
    for (const jobKey of jobKeys) {
      const result = await runCronJobForSchool(application, {
        jobKey,
        schoolId: school.id,
        asOf: options.asOf,
        requestId: `${options.requestIdPrefix ?? 'cron'}:${school.id}:${options.asOf.toISOString()}`,
      })
      results.push(result)
    }
  }

  return {
    asOf: options.asOf,
    results,
  }
}
