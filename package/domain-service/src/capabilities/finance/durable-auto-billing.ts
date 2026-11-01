import type { AutoBillingRun, ClaimedDurableWork } from '@edaya/core'
import type { SchoolApplication } from '../../services/school-application'
import { createSystemActorMetadata } from '@edaya/authorization'
import { ServiceEnrollmentSource, StudentServiceEnrollment } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { acceptedCatalogTerms } from './accepted-catalog-terms'
import { assignmentLock, AUTO_BILLING_WORK_KIND, billingConfigurationRevision, isAutoBillingEligible } from './auto-billing'
import { materializeServiceCharge } from './materialize-service-charge'

type Application = Pick<SchoolApplication, 'forActor' | 'durableWork'>
const PAGE_SIZE = 25

async function runPage(application: Application, work: ClaimedDurableWork): Promise<void> {
  const base = application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'auto-billing', requestId: work.id, reason: 'apply configured automatic fee assignments' })).baseService
  const store = base.repositories.autoBilling
  const original = await store.get(work.schoolId, work.resourceId)
  if (!original)
    throw new DurableWorkFailure('AUTO_BILLING_RUN_MISSING', true)
  let nextWork: string | undefined
  await base.commandExecution.execute<{ id: string }, { id: string }>({
    scope: await schoolCommandScope(base.actor, 'processAutoBillingPage', work.id),
    input: { workId: work.id },
    resultMode: 'ordinary',
    lockKeys: [`0-finance-state:${work.schoolId}`, `academic-state:${work.schoolId}`, `catalog:${original.catalogServiceId}`, `auto-billing-run:${original.id}`],
    authorize: async () => {
      const fee = await base.repositories.catalogServices.findById(original.catalogServiceId)
      if (!fee || fee.schoolId !== work.schoolId || fee.academicYearId !== original.academicYearId)
        throw new DurableWorkFailure('AUTO_BILLING_SCOPE_CHANGED', true)
    },
    execute: async () => {
      const run = (await store.get(work.schoolId, original.id))!
      if (run.workId !== work.id || run.status === 'completed')
        return { id: run.id }
      const fee = (await base.repositories.catalogServices.findById(run.catalogServiceId))!
      const candidates = !fee.isActive || fee.autoBilling.mode === 'off'
        ? []
        : run.studentId
          ? (run.cursor ? [] : [run.studentId])
          : await store.candidates(work.schoolId, run.academicYearId, run.cursor, PAGE_SIZE)
      for (const studentId of candidates) {
        await base.atomicExecution.execute(async () => {
          const fee = (await base.repositories.catalogServices.findById(run.catalogServiceId))!
          const eligible = await isAutoBillingEligible(base.repositories, fee, studentId)
          const existing = await base.repositories.studentServiceEnrollments.findOne({ schoolId: work.schoolId, studentId, catalogServiceId: fee.id, academicYearId: fee.academicYearId })
          if (!eligible || existing) {
            run.skippedCount++
            return
          }
          const id = `auto:${await digestCommandRequest([work.schoolId, fee.academicYearId, fee.id, studentId])}`
          const enrollment = new StudentServiceEnrollment({
            id,
            schoolId: work.schoolId,
            studentId,
            academicYearId: fee.academicYearId,
            catalogServiceId: fee.id,
            source: ServiceEnrollmentSource.Automatic,
            acceptedTerms: acceptedCatalogTerms(fee),
            automation: { runId: run.id, trigger: run.trigger, triggeredById: run.triggeredById, configurationRevision: await billingConfigurationRevision(fee) },
          })
          await base.entities.studentServiceEnrollments.save(enrollment)
          await materializeServiceCharge(base, enrollment)
          run.createdCount++
        }, { lockKeys: [assignmentLock(fee.id, studentId, fee.academicYearId)] })
        run.cursor = studentId
      }
      const more = !run.studentId && candidates.length === PAGE_SIZE
      nextWork = more ? crypto.randomUUID() : undefined
      const updated: AutoBillingRun = { ...run, status: more ? 'running' : 'completed', workId: nextWork ?? work.id, failureCode: undefined, updatedAt: new Date().toISOString() }
      await store.save(updated)
      return { id: run.id }
    },
    replay: async stored => stored,
    persistResult: result => result,
    audit: () => [{ event: 'autoBillingProcessed', resourceType: 'catalogServices', resourceId: original.catalogServiceId }],
    outbox: result => nextWork ? [{ id: nextWork, kind: AUTO_BILLING_WORK_KIND, version: 1, resourceType: 'autoBillingRuns', resourceId: result.id }] : [],
  })
}

export async function dispatchAutoBilling(application: Application, options: { maxPages?: number, maxDurationMs?: number } = {}) {
  const deadline = Date.now() + (options.maxDurationMs ?? 20000)
  for (let page = 0; page < (options.maxPages ?? 20) && Date.now() < deadline; page++) {
    const result = await runDurableWorkBatch(application.durableWork, {
      [AUTO_BILLING_WORK_KIND]: { version: 1, run: async (work) => {
        try {
          await runPage(application, work)
        }
        catch (error) {
          const base = application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'auto-billing', requestId: work.id, reason: 'record automatic billing failure' })).baseService
          await base.atomicExecution.execute(async () => {
            const run = await base.repositories.autoBilling.get(work.schoolId, work.resourceId)
            if (run?.workId === work.id && run.status !== 'completed')
              await base.repositories.autoBilling.save({ ...run, status: 'failed', failureCode: error instanceof DurableWorkFailure ? error.code : 'AUTO_BILLING_FAILED', updatedAt: new Date().toISOString() })
          }, { lockKeys: [`auto-billing-run:${work.resourceId}`] })
          throw error
        }
      } },
    }, { limit: 1, leaseMs: 300000 })
    if (result.completed + result.failed + result.lostLease === 0)
      break
  }
}
