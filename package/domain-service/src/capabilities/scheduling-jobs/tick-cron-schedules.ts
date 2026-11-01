import type { CronJobDispatcherPort, CronJobDispatchMessage, CronOccurrence } from '../../ports/platform'
import type { DurableCronApplication } from './durable-cron'
import { CRON_JOB_KEYS } from './cron-job-catalog'
import { CRON_DISPATCH_KIND, CRON_EXECUTE_KIND, cronExecutionId, dispatchCronOccurrences } from './durable-cron'

export interface CronHeartbeatSummary {
  readonly asOf: Date
  readonly dispatches: readonly CronJobDispatchMessage[]
  readonly delivery: { completed: number, failed: number, lostLease: number }
}

export async function tickCronSchedules(
  deps: {
    application: DurableCronApplication
    dispatcher: CronJobDispatcherPort
    computeNextRunAt: (cronExpression: string, after: Date) => Date
  },
  options: { asOf: Date, requestIdPrefix: string },
): Promise<CronHeartbeatSummary> {
  const { application } = deps
  const schedules = application.repositories.cronJobSchedules
  for (const candidate of await schedules.listDue(options.asOf)) {
    await application.atomicExecution.execute(async () => {
      // A competing heartbeat may have advanced this schedule while we waited.
      const schedule = await schedules.findById(candidate.id)
      if (!schedule?.enabled || schedule.nextRunAt > options.asOf)
        return
      if (!CRON_JOB_KEYS.includes(schedule.jobKey))
        throw new Error('Unsupported persisted cron job')
      const nextRunAt = deps.computeNextRunAt(schedule.cronExpression, options.asOf)
      if (!(nextRunAt > options.asOf))
        throw new Error('Cron schedules must advance beyond the heartbeat')
      for (const school of await application.repositories.schools.list()) {
        const requestId = `${schedule.id}:${schedule.nextRunAt.toISOString()}`
        const occurrence: CronOccurrence = {
          id: crypto.randomUUID(),
          schoolId: school.id,
          scheduleId: schedule.id,
          jobKey: schedule.jobKey,
          version: 1,
          scheduledFor: schedule.nextRunAt,
          asOf: options.asOf,
          requestId,
        }
        await application.commandExecution.execute({
          scope: { schoolId: school.id, command: 'cron.occurrence', callerId: 'system:cron', requestId },
          input: { scheduleId: schedule.id, jobKey: schedule.jobKey, scheduledFor: schedule.nextRunAt, asOf: options.asOf },
          resultMode: 'ordinary',
          authorize: async () => {
            if (!await application.repositories.schools.findById(school.id))
              throw new Error('Cron school unavailable')
          },
          execute: async () => {
            await schedules.saveOccurrence(occurrence)
            return { id: occurrence.id }
          },
          persistResult: result => result,
          replay: async result => result,
          audit: result => [{ event: 'cron.occurrence', resourceType: 'cron-occurrence', resourceId: result.id }],
          outbox: result => [
            { id: cronExecutionId(result.id), kind: CRON_EXECUTE_KIND, version: 1, resourceType: 'cron-occurrence', resourceId: result.id },
            { id: `cron-dispatch:${result.id}`, kind: CRON_DISPATCH_KIND, version: 1, resourceType: 'cron-occurrence', resourceId: result.id },
          ],
        })
      }
      await schedules.markDispatched(schedule.id, { nextRunAt, dispatchedAt: options.asOf })
    }, { lockKeys: [`cron-schedule:${candidate.id}`] })
  }
  // Run even when no schedule is due: a prior process may have died after commit.
  return { asOf: options.asOf, ...await dispatchCronOccurrences(application, deps.dispatcher) }
}
