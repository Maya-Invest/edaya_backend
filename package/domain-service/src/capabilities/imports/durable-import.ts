/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { ClaimedDurableWork, ImportExecutionOutcome, ImportIdentity, ImportRecord, ImportRow } from '@edaya/core'
import type { SchoolApplication } from '../../services/school-application'
import { resolveImportActor } from '@edaya/authorization'
import { IMPORT_COMPLETED_OUTCOMES, StudentClassEnrollmentStatus } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { executeImportRow, ImportBusinessContext, prepareImportRow } from './business'
import { collectionSnapshot, removeUnmentionedLinks, replaceCompleteContacts } from './collections'
import { importLocks, SCHOOL_IMPORT_WORK_KIND } from './import-service'
import { importErrorCode } from './normalization'

type Application = Pick<SchoolApplication, 'importPersistence' | 'forActor' | 'atomicExecution' | 'repositories' | 'commandExecution' | 'durableWork'>
async function readGroup(store: Application['importPersistence'], schoolId: string, batchId: string, row: ImportRow) {
  const ids = row.collection?.memberIds ?? [row.id]
  const rows: ImportRow[] = []
  for (let offset = 0; offset < ids.length; offset += 200)
    rows.push(...await store.queryRows(schoolId, batchId, { ids: ids.slice(offset, offset + 200), limit: 200 }))
  const byId = new Map(rows.map(item => [item.id, item]))
  if (ids.some(id => !byId.has(id)))
    throw new DurableWorkFailure('IMPORT_TARGET_CHANGED', true)
  return ids.map(id => byId.get(id)!)
}
async function blockPending(store: Application['importPersistence'], batch: { schoolId: string, id: string }, code: string, outcome: ImportRow['outcome'] = 'blocked') {
  let rows: ImportRow[]
  do {
    rows = await store.queryRows(batch.schoolId, batch.id, { outcome: 'pending', limit: 200 })
    await store.saveRows(rows.map(row => ({ ...row, outcome, issues: [{ code, severity: 'error' }] })))
  } while (rows.length)
}
const done = (row: ImportRow) => IMPORT_COMPLETED_OUTCOMES.includes(row.outcome)
function mutablePlan(value: ImportRecord | null): ImportRecord | null {
  if (!value)
    return value
  const result = { ...value }
  // Mirrored offerings receive their IDs through the subject/class workflow.
  if (typeof result['classSubjectId'] === 'string' && result['classSubjectId'].startsWith('pending:'))
    delete result['classSubjectId']
  return result
}
async function processPage(application: Application, work: ClaimedDurableWork, deadline: number): Promise<void> {
  const store = application.importPersistence
  const atomic = <T>(run: () => Promise<T>) => application.atomicExecution.execute(run, { lockKeys: importLocks(work.schoolId) })
  const batch = await atomic(() => store.getBatch(work.schoolId, work.resourceId))
  if (!batch?.approval || batch.state !== 'running')
    return
  const approval = batch.approval
  let actor: Awaited<ReturnType<typeof resolveImportActor>>
  try {
    actor = await atomic(() => resolveImportActor(application.repositories, work.schoolId, batch.academicYearId, approval, work.id))
  }
  catch {
    await atomic(async () => {
      const current = await store.getBatch(work.schoolId, batch.id)
      if (current?.state !== 'running' || current.revision !== approval.revision)
        return
      await blockPending(store, batch, 'IMPORT_AUTHORITY_REVOKED')
      current.state = 'completed'
      current.updatedAt = new Date().toISOString()
      await store.saveBatch(current)
    })
    return
  }
  const service = application.forActor(actor)
  let processed = 0
  let candidates: ImportRow[] = []
  while (processed < 10 && Date.now() < deadline) {
    if (!await application.durableWork.renew(work, 60000))
      return
    if (!candidates.length) {
      candidates = await atomic(async () => {
        const current = await store.getBatch(work.schoolId, batch.id)
        if (current?.state !== 'running' || current.revision !== approval.revision)
          return []
        return store.queryRows(work.schoolId, batch.id, { outcome: 'pending', ready: true, limit: 10 - processed })
      })
    }
    const candidate = candidates.shift()
    if (!candidate)
      break
    try {
      await service.baseService.commandExecution.execute<ImportRecord, ImportRecord>({
        scope: await schoolCommandScope(actor, 'executeSchoolImportRow', candidate.operationId),
        input: { batchId: batch.id, rowId: candidate.id, digest: candidate.inputDigest, revision: approval.revision },
        resultMode: 'ordinary',
        lockKeys: importLocks(work.schoolId),
        authorize: async () => {
          await resolveImportActor(application.repositories, work.schoolId, batch.academicYearId, approval, candidate.operationId)
        },
        execute: async (): Promise<ImportRecord> => {
          const currentBatch = await store.getBatch(work.schoolId, batch.id)
          if (currentBatch?.state !== 'running' || currentBatch.revision !== approval.revision)
            return { stopped: true }
          const row = (await store.queryRows(work.schoolId, batch.id, { ids: [candidate.id], outcome: 'pending', ready: true, limit: 1 }))[0]
          if (!row || row.operationId !== candidate.operationId)
            return { stopped: true }
          const ctx = new ImportBusinessContext(service, currentBatch)
          // Recheck the entire affected cohort under the same academic lock as the placement.
          const classId = row.type === 'students' && row.proposed?.['classGroupId']
          if (typeof classId === 'string') {
            const cohort = await store.pendingClassCohort(work.schoolId, batch.id, classId)
            if (cohort.length) {
              const group = await ctx.readable('classGroups', classId)
              if (typeof group.capacity === 'number') {
                const active = await service.baseService.repositories.enrollments.forSchool!(work.schoolId).list({ classGroupId: classId, status: StudentClassEnrollmentStatus.Active })
                const existing = new Set(active.map(item => item.studentId))
                const added = new Set(cohort.filter(item => !existing.has(item.targetId)).map(item => item.targetId))
                if (existing.size + added.size > group.capacity) {
                  for (let offset = 0; offset < cohort.length; offset += 200) {
                    const failures = await store.queryRows(work.schoolId, batch.id, { ids: cohort.slice(offset, offset + 200).map(item => item.id), limit: 200 })
                    await store.saveRows(failures.map(item => ({ ...item, outcome: 'blocked', issues: [...item.issues, { code: 'IMPORT_CLASS_CAPACITY_CONFLICT', column: 'class', severity: 'error' }] })))
                  }
                  if (cohort.some(item => item.id === row.id))
                    return { blocked: true }
                }
              }
            }
          }
          const group = await readGroup(store, work.schoolId, batch.id, row)
          if (row.collection && await digestCommandRequest(await collectionSnapshot(ctx, row.type, row.collection.ownerId)) !== await digestCommandRequest(row.collection.before))
            throw new DurableWorkFailure('IMPORT_TARGET_CHANGED', true)
          const preparedGroup: ImportRow[] = []
          for (const member of group) {
            const prepared = await prepareImportRow(ctx, structuredClone(member))
            const generatedOffering = member.type === 'class_offerings' && member.current === null && member.dependencies.length > 0
            if (!done(member) && !generatedOffering && (prepared.expectedDigest !== await digestCommandRequest(member.current) || await digestCommandRequest(mutablePlan(typeof member.proposed?.['classSubjectId'] === 'string' && member.proposed['classSubjectId'].startsWith('pending:') ? { ...prepared.proposed, classSubjectId: member.proposed['classSubjectId'] } : prepared.proposed)) !== await digestCommandRequest(mutablePlan(member.proposed))))
              throw new DurableWorkFailure('IMPORT_TARGET_CHANGED', true)
            prepared.collection = member.collection
            preparedGroup.push(prepared)
          }
          if (row.collection && row.type === 'guardian_contacts')
            await replaceCompleteContacts(ctx, preparedGroup)
          if (row.collection && row.type === 'guardian_relationships')
            await removeUnmentionedLinks(ctx, preparedGroup)
          const completedRows: ImportRow[] = []
          const identities: ImportIdentity[] = []
          const outcomes: ImportExecutionOutcome[] = []
          for (let i = 0; i < preparedGroup.length; i++) {
            const prepared = preparedGroup[i]!
            const member = group[i]!
            if (done(member))
              continue
            const unchanged = prepared.current !== null && await digestCommandRequest(prepared.current) === await digestCommandRequest(prepared.proposed)
            const result = (row.collection && row.type === 'guardian_contacts') || (prepared.current && (prepared.effectiveMode === 'S' || unchanged)) ? { targetId: prepared.targetId } : await executeImportRow(ctx, prepared)
            const outcome = prepared.current ? prepared.effectiveMode === 'S' || (unchanged && ['billing', 'payments'].includes(prepared.type)) ? 'skipped' : unchanged && !row.collection ? 'unchanged' : 'updated' : 'created'
            const targetId = String(result['targetId'] ?? prepared.targetId)
            identities.push({ schoolId: work.schoolId, type: member.type, sourceKey: member.sourceKey, targetId, generatedCode: member.generatedCode, bound: true })
            outcomes.push({ schoolId: work.schoolId, batchId: batch.id, rowId: member.id, operationId: member.operationId, inputDigest: member.inputDigest, targetId, outcome, result, completedAt: new Date().toISOString() })
            completedRows.push({ ...member, targetId, outcome, result })
          }
          await store.saveIdentities(identities)
          await store.addOutcomes(outcomes)
          await store.saveRows(completedRows)
          return { rowId: row.id }
        },
        persistResult: result => result,
        replay: async stored => stored,
        audit: () => [{ event: 'schoolImportRowExecuted', resourceType: 'schoolImportRows', resourceId: candidate.id }],
      })
    }
    catch (error) {
      const code = error instanceof DurableWorkFailure ? error.code : importErrorCode(error)
      if (code === 'IMPORT_TRANSIENT_FAILURE')
        throw new DurableWorkFailure('IMPORT_TRANSIENT_FAILURE')
      await atomic(async () => {
        const current = await store.getBatch(work.schoolId, batch.id)
        if (current?.state !== 'running' || current.revision !== approval.revision)
          return
        const row = (await store.queryRows(work.schoolId, batch.id, { ids: [candidate.id], limit: 1 }))[0]
        if (row?.outcome === 'pending') {
          const group = await readGroup(store, work.schoolId, batch.id, row)
          await store.saveRows(group.filter(member => member.outcome === 'pending').map(member => ({ ...member, outcome: 'blocked', issues: [{ code, severity: 'error' }] })))
        }
      })
    }
    processed++
  }
  let continuation = false
  const nextWorkId = crypto.randomUUID()
  await application.commandExecution.execute<{
    id: string
  }, {
    id: string
  }>({
    scope: await schoolCommandScope(actor, 'advanceSchoolImport', work.id),
    input: { workId: work.id },
    resultMode: 'ordinary',
    lockKeys: importLocks(work.schoolId),
    authorize: async () => { },
    execute: async () => {
      const current = await store.getBatch(work.schoolId, batch.id)
      if (current?.state !== 'running' || current.revision !== approval.revision)
        return { id: batch.id }
      // Propagate failed dependencies in bounded pages, including transitive children.
      let blocked: ImportRow[]
      do {
        blocked = await store.queryRows(work.schoolId, batch.id, { outcome: 'pending', dependencyBlocked: true, limit: 200 })
        await store.saveRows(blocked.map(row => ({ ...row, outcome: 'dependency_blocked', issues: [{ code: 'IMPORT_DEPENDENCY_BLOCKED', severity: 'error' }] })))
      } while (blocked.length)
      continuation = (await store.queryRows(work.schoolId, batch.id, { outcome: 'pending', limit: 1 })).length > 0
      if (!continuation)
        current.state = 'completed'
      current.workId = continuation ? nextWorkId : null
      current.updatedAt = new Date().toISOString()
      await store.saveBatch(current)
      return { id: current.id }
    },
    replay: async stored => stored,
    persistResult: result => result,
    audit: result => [{ event: 'schoolImportProgressed', resourceType: 'schoolImports', resourceId: result.id }],
    outbox: result => continuation ? [{ id: nextWorkId, kind: SCHOOL_IMPORT_WORK_KIND, version: 1, resourceType: 'schoolImports', resourceId: result.id }] : [],
  })
}
async function reconcileExhaustedImports(application: Application) {
  const batches = await application.atomicExecution.execute(() => application.importPersistence.exhaustedBatches(100))
  for (const batch of batches) {
    await application.atomicExecution.execute(async () => {
      const current = await application.importPersistence.getBatch(batch.schoolId, batch.id)
      if (current?.state !== 'running' || !current.workId || (await application.durableWork.getState(current.workId))?.status !== 'dead')
        return
      await blockPending(application.importPersistence, current, 'IMPORT_RETRY_EXHAUSTED', 'failed')
      current.state = 'completed'
      current.updatedAt = new Date().toISOString()
      await application.importPersistence.saveBatch(current)
    }, { lockKeys: importLocks(batch.schoolId) })
  }
}
/** Drain bounded pages using the same durable claims; elapsed budgets never cancel a row transaction. */
export async function dispatchSchoolImports(application: Application, options: { maxPages?: number, maxDurationMs?: number } = {}) {
  await reconcileExhaustedImports(application)
  const maxPages = Math.max(1, Math.min(1000, options.maxPages ?? 1))
  const deadline = Date.now() + Math.max(1, Math.min(300000, options.maxDurationMs ?? 300000))
  const total = { completed: 0, failed: 0, lostLease: 0 }
  for (let page = 0; page < maxPages && Date.now() < deadline; page++) {
    const result = await runDurableWorkBatch(application.durableWork, { [SCHOOL_IMPORT_WORK_KIND]: { version: 1, run: work => processPage(application, work, deadline) } }, { limit: 1, leaseMs: 60000 })
    total.completed += result.completed
    total.failed += result.failed
    total.lostLease += result.lostLease
    if (!result.completed)
      break
  }
  await reconcileExhaustedImports(application)
  return total
}
