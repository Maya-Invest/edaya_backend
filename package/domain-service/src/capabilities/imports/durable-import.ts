/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { ClaimedDurableWork, ImportRecord, ImportRow } from '@edaya/core'
import type { SchoolApplication } from '../../services/school-application'
import { resolveImportActor } from '@edaya/authorization'
import { IMPORT_COMPLETED_OUTCOMES, IMPORT_TEMPLATES } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { DurableWorkFailure, runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { executeImportRow, ImportBusinessContext, prepareImportRow, validateImportCapacity } from './business'
import { collectionSnapshot, completeCollectionRows, removeUnmentionedLinks, replaceCompleteContacts } from './collections'
import { importLocks, SCHOOL_IMPORT_WORK_KIND } from './import-service'
import { importErrorCode } from './normalization'

type Application = Pick<SchoolApplication, 'importPersistence' | 'forActor' | 'atomicExecution' | 'repositories' | 'commandExecution' | 'durableWork'>
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
      const rows = await store.listRows(work.schoolId, batch.id)
      await store.saveRows(rows.filter(row => row.outcome === 'pending').map(row => ({ ...row, outcome: 'blocked', issues: [{ code: 'IMPORT_AUTHORITY_REVOKED', severity: 'error' }] })))
      current.state = 'completed'
      current.updatedAt = new Date().toISOString()
      await store.saveBatch(current)
    })
    return
  }
  const service = application.forActor(actor)
  let processed = 0
  while (processed < 10 && Date.now() < deadline) {
    if (!await application.durableWork.renew(work, 60000))
      return
    const candidate = await atomic(async () => {
      const current = await store.getBatch(work.schoolId, batch.id)
      if (current?.state !== 'running' || current.revision !== approval.revision)
        return undefined
      const rows = await store.listRows(work.schoolId, batch.id)
      const ready = rows.filter(row => row.outcome === 'pending' && row.dependencies.every(id => rows.some(parent => parent.id === id && done(parent))))
      return ready.sort((a, b) => IMPORT_TEMPLATES[a.type].rank - IMPORT_TEMPLATES[b.type].rank || a.id.localeCompare(b.id))[0]
    })
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
          const rows = await store.listRows(work.schoolId, batch.id)
          const row = rows.find(row => row.id === candidate.id)!
          if (row.outcome !== 'pending' || row.operationId !== candidate.operationId)
            return { stopped: true }
          const ctx = new ImportBusinessContext(service, currentBatch)
          // Capacity is re-evaluated for the whole pending cohort before any member commits.
          const pending = rows.filter(row => row.outcome === 'pending').map(row => structuredClone(row))
          await validateImportCapacity(new ImportBusinessContext(service, currentBatch, rows), pending)
          const capacityFailures = pending.filter(row => row.outcome === 'blocked')
          if (capacityFailures.length)
            await store.saveRows(capacityFailures)
          if (capacityFailures.some(item => item.id === row.id))
            return { blocked: true }
          const group = completeCollectionRows(row, rows)
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
          for (let i = 0; i < preparedGroup.length; i++) {
            const prepared = preparedGroup[i]!
            const member = group[i]!
            if (done(member))
              continue
            const unchanged = prepared.current !== null && await digestCommandRequest(prepared.current) === await digestCommandRequest(prepared.proposed)
            const result = (row.collection && row.type === 'guardian_contacts') || (prepared.current && (prepared.effectiveMode === 'S' || unchanged)) ? { targetId: prepared.targetId } : await executeImportRow(ctx, prepared)
            const outcome = prepared.current ? prepared.effectiveMode === 'S' || (unchanged && ['billing', 'payments'].includes(prepared.type)) ? 'skipped' : unchanged && !row.collection ? 'unchanged' : 'updated' : 'created'
            const targetId = String(result['targetId'] ?? prepared.targetId)
            await store.saveIdentity({ schoolId: work.schoolId, type: member.type, sourceKey: member.sourceKey, targetId, generatedCode: member.generatedCode, bound: true })
            await store.addOutcome({ schoolId: work.schoolId, batchId: batch.id, rowId: member.id, operationId: member.operationId, inputDigest: member.inputDigest, targetId, outcome, result, completedAt: new Date().toISOString() })
            await store.saveRows([{ ...member, targetId, outcome, result }])
          }
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
        const row = (await store.listRows(work.schoolId, batch.id)).find(row => row.id === candidate.id)
        if (row?.outcome === 'pending') {
          const rows = await store.listRows(work.schoolId, batch.id)
          await store.saveRows(completeCollectionRows(row, rows).filter(member => member.outcome === 'pending').map(member => ({ ...member, outcome: 'blocked', issues: [{ code, severity: 'error' }] })))
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
      const rows = await store.listRows(work.schoolId, batch.id)
      for (const row of rows) {
        if (row.outcome === 'pending' && row.dependencies.some(id => !rows.some(parent => parent.id === id && (done(parent) || parent.outcome === 'pending')))) {
          row.outcome = 'dependency_blocked'
          row.issues = [{ code: 'IMPORT_DEPENDENCY_BLOCKED', severity: 'error' }]
          await store.saveRows([row])
        }
      }
      continuation = rows.some(row => row.outcome === 'pending')
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
/** Drain bounded pages using the same durable claims; elapsed budgets never cancel a row transaction. */
export async function dispatchSchoolImports(application: Application, options: { maxPages?: number, maxDurationMs?: number } = {}) {
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
  return total
}
