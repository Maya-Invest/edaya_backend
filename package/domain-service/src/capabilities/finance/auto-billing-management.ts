import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { AUTO_BILLING_WORK_KIND } from './auto-billing'

export async function getAutoBillingOptions(base: BaseSchoolService) {
  await base.access.finance.assertReadAutoBilling()
  const [grades, statuses] = await Promise.all([
    base.repositories.gradeLevels.list({ schoolId: base.actor.schoolId }),
    base.repositories.placementStatuses.list({ schoolId: base.actor.schoolId }),
  ])
  let canConfigureAutomatic = false
  try {
    await base.access.finance.assertConfigureAutoBilling()
    canConfigureAutomatic = true
  }
  catch { /* The picker remains readable without assignment authority. */ }
  return {
    canConfigureAutomatic,
    gradeLevels: grades.map(row => ({ id: row.id, label: row.label || row.name })),
    placementStatuses: statuses.map(row => ({ id: row.id, label: row.label, isActive: row.isActive })),
  }
}

export async function getFeeAutoBilling(base: BaseSchoolService, input: { catalogServiceId: string }) {
  const fee = await base.entities.catalogServices.findById(input.catalogServiceId)
  if (!fee)
    denyResourceAccess()
  // Job progress covers a whole fee, so a student/class-scoped grant is insufficient.
  await base.access.finance.assertReadAutoBilling()
  const runs = await base.repositories.autoBilling.listForFee(base.actor.schoolId, fee.id)
  return { runs: await Promise.all(runs.map(async (run) => {
    const state = await base.durableWork?.getState(run.workId)
    const status = run.status === 'completed'
      ? 'completed' as const
      : !state || state.status === 'dead' || state.status === 'failed'
          ? 'failed' as const
          : state.status === 'running' ? 'running' as const : run.status
    return { id: run.id, status, createdCount: run.createdCount, skippedCount: run.skippedCount, failureCode: status === 'failed' ? run.failureCode ?? 'AUTO_BILLING_FAILED' : undefined, createdAt: run.createdAt, updatedAt: run.updatedAt }
  })) }
}

export async function retryAutoBilling(base: BaseSchoolService, input: { runId: string, requestId: string }) {
  let nextWork: string | undefined
  return base.commandExecution.execute<{ id: string }, { id: string }>({
    scope: await schoolCommandScope(base.actor, 'retryAutoBilling', input.requestId),
    input,
    resultMode: 'ordinary',
    lockKeys: [`auto-billing-run:${input.runId}`],
    authorize: async () => {
      const run = await base.repositories.autoBilling.get(base.actor.schoolId, input.runId)
      if (!run)
        denyResourceAccess()
      await base.access.finance.assertConfigureAutoBilling(run.academicYearId)
    },
    execute: async () => {
      const run = (await base.repositories.autoBilling.get(base.actor.schoolId, input.runId))!
      const state = await base.durableWork?.getState(run.workId)
      if (run.status === 'completed' || (state && !['failed', 'dead'].includes(state.status)))
        throw new BusinessRuleViolationError('AUTO_BILLING_NOT_FAILED', 'Only failed billing runs can be retried')
      nextWork = crypto.randomUUID()
      await base.repositories.autoBilling.save({ ...run, workId: nextWork, status: 'pending', failureCode: undefined, updatedAt: new Date().toISOString() })
      return { id: run.id }
    },
    replay: async stored => stored,
    persistResult: result => result,
    audit: result => [{ event: 'autoBillingRetried', resourceType: 'autoBillingRuns', resourceId: result.id }],
    outbox: result => nextWork ? [{ id: nextWork, kind: AUTO_BILLING_WORK_KIND, version: 1, resourceType: 'autoBillingRuns', resourceId: result.id }] : [],
  })
}
