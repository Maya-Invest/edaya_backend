/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { CoreEntityKey, CoreEntityMap, ImportBatch, ImportExistingMode, ImportFileRevision, ImportFormatPort, ImportIdentity, ImportPersistencePort, ImportProgress, ImportReadTarget, ImportRow, ImportType, ImportValues } from '@edaya/core'
import type { SchoolService } from '../../services/school-service'
import { ImportAccessPolicy, importResources } from '@edaya/authorization'
import { BusinessRuleViolationError, IMPORT_COMPLETED_OUTCOMES, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, IMPORT_TEMPLATE_VERSION, IMPORT_TEMPLATES, normalizeHumanIdentifier, normalizeReferenceText, parseImportDate, resolveImportExistingMode, StudentClassEnrollmentStatus } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { loadInBatches } from '../shared/bounded-reads'
import { ImportBusinessContext, ImportBusinessIssue, prepareImportRow, prepareMirroredOfferingIds, validateImportCapacity } from './business'
import { prepareCompleteCollections } from './collections'
import { importErrorCode, importJson, normalizeImportTable, normalizeImportValues } from './normalization'

export const SCHOOL_IMPORT_WORK_KIND = 'school-import.execute'
export const importLock = (schoolId: string) => `school-import:${schoolId}`
export const importLocks = (schoolId: string) => [`0-finance-state:${schoolId}`, `academic-state:${schoolId}`, `permission-state:${schoolId}`, importLock(schoolId)]
const stamp = () => new Date().toISOString()
function fail(code: string): never {
  throw new BusinessRuleViolationError(code, code)
}
export interface ImportDetail {
  batch: ImportBatch
  files: ImportFileRevision[]
  rows: ImportRow[]
  counts: Record<string, number>
}
export class SchoolImportService {
  private readonly policy: ImportAccessPolicy
  constructor(readonly service: SchoolService, readonly store: ImportPersistencePort, readonly format: ImportFormatPort, readonly durableWork?: import('@edaya/core').DurableWorkPort) {
    this.policy = new ImportAccessPolicy(service.baseService.access)
  }

  get base() { return this.service.baseService }
  private atomic<T>(run: () => Promise<T>) { return this.base.atomicExecution.execute(run, { lockKeys: importLocks(this.base.actor.schoolId) }) }
  async requireBatch(id: string) {
    const batch = await this.store.getBatch(this.base.actor.schoolId, id)
    if (!batch)
      fail('IMPORT_BATCH_NOT_FOUND')
    await this.policy.assertSession(batch)
    return batch
  }

  private async assertOwner(batch: ImportBatch) {
    const actor = await this.policy.assertSession(batch)
    if (actor.staffMemberId !== batch.createdByStaffId || actor.subjectId !== batch.createdBySubjectId)
      fail('IMPORT_BATCH_OWNER_REQUIRED')
    return actor
  }

  private mutable(batch: ImportBatch) {
    if (batch.state === 'running')
      fail('IMPORT_BATCH_RUNNING')
  }

  private invalidate(batch: ImportBatch) {
    batch.revision++
    batch.previewDigest = null
    batch.approval = null
    batch.state = 'draft'
    batch.updatedAt = stamp()
  }

  async create(input: {
    academicYearId: string
    defaultOnExisting?: ImportExistingMode
    enrollmentEffectiveDate?: string | null
  }): Promise<ImportBatch> {
    return this.atomic(async () => {
      const actor = await this.policy.assertSession()
      const year = await this.base.entities.academicYears.findById(input.academicYearId)
      if (!year || year.schoolId !== actor.schoolId)
        fail('IMPORT_YEAR_INVALID')
      const batch: ImportBatch = { id: crypto.randomUUID(), schoolId: actor.schoolId, academicYearId: year.id, createdByStaffId: actor.staffMemberId, createdBySubjectId: actor.subjectId, defaultOnExisting: resolveImportExistingMode(input.defaultOnExisting), enrollmentEffectiveDate: input.enrollmentEffectiveDate ? parseImportDate(input.enrollmentEffectiveDate) : null, revision: 1, state: 'draft', previewDigest: null, workId: null, approval: null, createdAt: stamp(), updatedAt: stamp() }
      await this.store.saveBatch(batch)
      return batch
    })
  }

  async settings(input: {
    batchId: string
    defaultOnExisting: ImportExistingMode
    enrollmentEffectiveDate?: string | null
  }): Promise<ImportBatch> {
    return this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.mutable(batch)
      const mode = resolveImportExistingMode(input.defaultOnExisting)
      const date = input.enrollmentEffectiveDate === undefined ? batch.enrollmentEffectiveDate : input.enrollmentEffectiveDate ? parseImportDate(input.enrollmentEffectiveDate) : null
      if (mode !== batch.defaultOnExisting || date !== batch.enrollmentEffectiveDate) {
        batch.defaultOnExisting = mode
        batch.enrollmentEffectiveDate = date
        this.invalidate(batch)
        await this.store.saveBatch(batch)
      }
      return batch
    })
  }

  async submit(input: {
    batchId: string
    fileId?: string
    type: ImportType
    fileName: string
    bytes: Uint8Array
  }): Promise<ImportFileRevision> {
    if (!IMPORT_TEMPLATES[input.type] || input.bytes.length > IMPORT_MAX_FILE_BYTES || !input.bytes.length || input.fileName.length > 200)
      fail('IMPORT_FILE_INVALID')
    // Authenticate before parsing potentially expensive untrusted bytes.
    await this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.mutable(batch)
      await this.policy.assertType(input.type, true)
    })
    const parsed = await this.format.parse(input)
    const normalized = normalizeImportTable(input.type, parsed)
    const digest = await crypto.subtle.digest('SHA-256', input.bytes as Uint8Array<ArrayBuffer>)
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
    const revisionId = crypto.randomUUID()
    const storageKey = `schools/${this.base.actor.schoolId}/imports/${input.batchId}/${revisionId}`
    await this.atomic(async () => {
      await this.base.repositories.privateFiles.reserve({ schoolId: this.base.actor.schoolId, storageKey, protectedUntil: new Date(Date.now() + 60 * 60 * 1000) })
    })
    await this.base.fileStorage.putObject({ key: storageKey, body: input.bytes, contentType: /\.csv$/i.test(input.fileName) ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    return this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.mutable(batch)
      await this.policy.assertType(input.type, true)
      const files = await this.store.listFiles(batch.schoolId, batch.id)
      const duplicate = files.find(file => file.sha256 === sha256 && file.type === input.type && (!input.fileId || file.fileId === input.fileId))
      if (duplicate)
        return duplicate
      const prior = input.fileId ? files.filter(file => file.fileId === input.fileId).at(-1) : undefined
      if (input.fileId && (!prior || prior.type !== input.type))
        fail('IMPORT_FILE_REFERENCE_INVALID')
      const file: ImportFileRevision = { id: revisionId, fileId: prior?.fileId ?? crypto.randomUUID(), schoolId: batch.schoolId, batchId: batch.id, type: input.type, templateVersion: IMPORT_TEMPLATE_VERSION, revision: (prior?.revision ?? 0) + 1, fileName: input.fileName, storageKey, sha256, headers: parsed.headers, createdAt: stamp() }
      const previousRows = await this.store.listRows(batch.schoolId, batch.id)
      if (previousRows.filter(row => row.source.fileId !== file.fileId).length + normalized.length > IMPORT_MAX_ROWS)
        fail('IMPORT_BATCH_ROW_LIMIT')
      const previousById = new Map(previousRows.filter(row => row.source.fileId === file.fileId).map(row => [row.id, row]))
      const sourceKeys = normalized.flatMap((row) => {
        const sourceId = String(row.values['source_id'] ?? '').trim()
        const previous = previousById.get(String(row.values['row_id'] ?? '').trim())
        return sourceId ? [`source:${sourceId}`] : previous ? [previous.sourceKey] : []
      })
      const identityByKey = new Map((await this.store.getIdentities(batch.schoolId, file.type, sourceKeys)).map(identity => [identity.sourceKey, identity]))
      const pendingIdentities = new Map<string, ImportIdentity>()
      const seen = new Set<string>()
      const rows: ImportRow[] = []
      for (const parsedRow of normalized) {
        const requested = String(parsedRow.values['row_id'] ?? '').trim()
        const previous = requested ? previousById.get(requested) : undefined
        if (requested && !previous)
          fail('IMPORT_ROW_ID_UNKNOWN')
        const id = previous?.id ?? crypto.randomUUID()
        if (seen.has(id))
          fail('IMPORT_ROW_ID_DUPLICATE')
        seen.add(id)
        const sourceId = String(parsedRow.values['source_id'] ?? '').trim()
        if (sourceId.length > 200)
          fail('IMPORT_SOURCE_ID_INVALID')
        const sourceKey = sourceId ? `source:${sourceId}` : previous?.sourceKey ?? `row:${file.fileId}:${id}`
        const identity = identityByKey.get(sourceKey)
        const row: ImportRow = { id, batchId: batch.id, schoolId: batch.schoolId, type: file.type, source: { fileId: file.fileId, revisionId: file.id, row: parsedRow.sourceRow, ...(parsed.sheet ? { sheet: parsed.sheet } : {}) }, raw: parsedRow.raw, values: { ...parsedRow.values, row_id: id }, targetId: identity?.targetId ?? (previous?.sourceKey === sourceKey ? previous.targetId : undefined) ?? crypto.randomUUID(), sourceKey, effectiveMode: batch.defaultOnExisting, inputDigest: '', operationId: crypto.randomUUID(), dependencies: [], current: null, proposed: null, expectedDigest: null, issues: parsedRow.issues, outcome: parsedRow.issues.length ? 'blocked' : 'pending', result: null }
        const nextIdentity = { schoolId: batch.schoolId, type: file.type, sourceKey, targetId: row.targetId, bound: identity?.bound ?? false }
        identityByKey.set(sourceKey, nextIdentity)
        pendingIdentities.set(sourceKey, nextIdentity)
        rows.push(row)
      }
      // Missing rows on a replacement are retained as history, never executed accidentally.
      const removed = previousRows.filter(row => row.source.fileId === file.fileId && !seen.has(row.id) && !IMPORT_COMPLETED_OUTCOMES.includes(row.outcome)).map(row => ({ ...row, outcome: 'cancelled' as const }))
      await this.store.saveIdentities([...pendingIdentities.values()])
      await this.store.addFile(file)
      await this.store.saveRows([...rows, ...removed])
      await this.base.repositories.privateFiles.retain({ schoolId: batch.schoolId, sourceType: 'capability.school-import', sourceId: file.id, slot: 'original', storageKey })
      this.invalidate(batch)
      await this.store.saveBatch(batch)
      return file
    })
  }

  async validate(input: {
    batchId: string
  }): Promise<ImportDetail> {
    await this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.mutable(batch)
      const files = await this.store.listFiles(batch.schoolId, batch.id)
      const latest = new Map(files.map(file => [file.fileId, file.id]))
      const allRows = await this.store.listRows(batch.schoolId, batch.id)
      const rows = allRows.filter(row => row.source.revisionId === latest.get(row.source.fileId)).sort((a, b) => IMPORT_TEMPLATES[a.type].rank - IMPORT_TEMPLATES[b.type].rank || a.id.localeCompare(b.id))
      const knownIdentities = new Map<string, ImportIdentity>()
      for (const type of new Set(rows.map(row => row.type))) {
        for (const identity of await this.store.getIdentities(batch.schoolId, type, rows.filter(row => row.type === type).map(row => row.sourceKey)))
          knownIdentities.set(JSON.stringify([type, identity.sourceKey]), identity)
      }
      const replayCandidates: ImportRow[] = []
      const preparedIdentities: ImportIdentity[] = []
      const ctx = new ImportBusinessContext(this.service, batch, rows, 'validation')
      const suppliedIdentifiers = new Map<string, ImportRow[]>()
      for (const row of rows) {
        // Only explicit revalidation may discard a legacy allocation proposal.
        if ('generatedIdentifier' in row) {
          if (row.generatedIdentifier)
            delete row.values['identifier']
          delete row.generatedIdentifier
        }
        if ('identifierReview' in row)
          delete row.identifierReview
        if (!['students', 'teachers', 'guardians', 'staff'].includes(row.type) || !String(row.values['identifier'] ?? '').trim())
          continue
        const key = JSON.stringify([row.type, normalizeHumanIdentifier(String(row.values['identifier']))])
        suppliedIdentifiers.set(key, [...suppliedIdentifiers.get(key) ?? [], row])
      }
      const duplicateIdentifiers = new Set([...suppliedIdentifiers.values()].filter(group => group.length > 1).flat().map(row => row.id))
      for (const row of rows) {
        row.issues = row.issues.filter(issue => issue.code === 'IMPORT_COLUMN_UNSUPPORTED')
        row.proposed = null
        row.current = null
        row.dependencies = []
        row.resolvedReferences = {}
        row.referenceReviews = {}
        row.result = null
        if (duplicateIdentifiers.has(row.id))
          row.issues.push({ code: 'IMPORT_DUPLICATE_TARGET', column: 'identifier', severity: 'error' })
        try {
          row.effectiveMode = resolveImportExistingMode(row.values['on_existing'], batch.defaultOnExisting)
          if (row.issues.length) {
            row.outcome = 'blocked'
            continue
          }
          await prepareImportRow(ctx, row)
          const identity = knownIdentities.get(JSON.stringify([row.type, row.sourceKey]))
          if (identity?.bound && identity.targetId !== row.targetId)
            fail('IMPORT_IDENTITY_CONFLICT')
          preparedIdentities.push({ schoolId: batch.schoolId, type: row.type, sourceKey: row.sourceKey, targetId: row.targetId, bound: identity?.bound ?? false })
          row.inputDigest = await digestCommandRequest({ type: row.type, values: normalizeImportValues(row.type, row.values), sourceKey: row.sourceKey, mode: row.effectiveMode, academicYearId: batch.academicYearId, enrollmentEffectiveDate: batch.enrollmentEffectiveDate })
          row.operationId = crypto.randomUUID()
          replayCandidates.push(row)
        }
        catch (error) {
          const code = importErrorCode(error)
          if (code === 'IMPORT_TRANSIENT_FAILURE')
            throw error
          row.outcome = code === 'IMPORT_DEPENDENCY_BLOCKED' ? 'dependency_blocked' : 'blocked'
          row.issues.push({ code, severity: 'error', ...(error instanceof ImportBusinessIssue && error.candidates.length ? { candidates: error.candidates } : {}), ...(error instanceof ImportBusinessIssue && error.field ? { column: error.field } : {}), ...(code === 'IMPORT_ON_EXISTING_INVALID' ? { column: 'on_existing' } : {}) })
        }
      }
      await this.store.saveIdentities([...new Map(preparedIdentities.map(identity => [JSON.stringify([identity.type, identity.sourceKey]), identity])).values()])
      await this.requireTargetDecisions(ctx, rows)
      const outcomes = await this.store.findOutcomes(batch.schoolId, batch.id, replayCandidates.map(row => ({ rowId: row.id, inputDigest: row.inputDigest })))
      const outcomesByRow = new Map(outcomes.map(outcome => [outcome.rowId, outcome]))
      for (const row of replayCandidates) {
        const previous = outcomesByRow.get(row.id)
        if (previous && IMPORT_COMPLETED_OUTCOMES.includes(previous.outcome)) {
          row.outcome = previous.outcome
          row.targetId = previous.targetId
          row.result = previous.result
          row.operationId = previous.operationId
        }
      }
      const identities = new Map<string, ImportRow[]>()
      for (const row of rows.filter(row => row.proposed)) {
        const data = row.proposed!
        const fields: Record<ImportType, string[]> = {
          academic_disciplines: [],
          placement_statuses: [],
          students: ['identifier'],
          teachers: ['identifier'],
          guardians: ['identifier'],
          staff: ['identifier'],
          classes: [],
          subjects: [],
          guardian_relationships: ['guardianId', 'studentId'],
          class_offerings: ['classGroupId', 'subjectId'],
          teacher_assignments: ['teacherId', 'kind', 'classGroupId', 'subjectId'],
          chapters: [],
          billing: ['studentId', 'catalogServiceId'],
          payments: ['reference'],
        }
        const keys = fields[row.type].length ? [`${row.type}:business:${fields[row.type].map(field => String(data[field] ?? '').trim().toUpperCase()).join('\0')}`] : []
        keys.push(`${row.type}:target:${row.targetId}`)
        for (const identity of keys)
          identities.set(identity, [...identities.get(identity) ?? [], row])
      }
      for (const duplicates of identities.values()) {
        if (duplicates.length > 1) {
          for (const row of duplicates.filter(row => row.outcome === 'pending')) {
            row.outcome = 'blocked'
            row.issues.push({ code: 'IMPORT_DUPLICATE_TARGET', severity: 'error' })
          }
        }
      }
      prepareMirroredOfferingIds(rows)
      await prepareCompleteCollections(ctx, rows)
      await validateImportCapacity(ctx, rows)
      for (const row of rows) {
        if (row.outcome === 'pending' && row.dependencies.some(id => rows.find(other => other.id === id)?.outcome === 'blocked' || rows.find(other => other.id === id)?.outcome === 'dependency_blocked')) {
          row.outcome = 'dependency_blocked'
          row.issues.push({ code: 'IMPORT_DEPENDENCY_BLOCKED', severity: 'error' })
        }
      }
      batch.revision++
      batch.state = 'validated'
      batch.approval = null
      batch.updatedAt = stamp()
      batch.previewDigest = await digestCommandRequest({ revision: batch.revision, mode: batch.defaultOnExisting, rows: rows.map(row => ({ id: row.id, input: row.inputDigest, expected: row.expectedDigest, proposed: row.proposed, mode: row.effectiveMode, outcome: row.outcome, dependencies: row.dependencies })) })
      await this.store.saveRows(rows)
      await this.store.saveBatch(batch)
    })
    return this.detail(input.batchId)
  }

  async confirm(input: {
    batchId: string
    revision: number
    previewDigest: string
  }): Promise<ImportBatch> {
    const actor = await this.policy.assertSession()
    return this.base.commandExecution.execute({
      scope: await schoolCommandScope(actor, 'confirmSchoolImport', `${input.batchId}:${input.revision}`),
      input,
      resultMode: 'ordinary',
      lockKeys: importLocks(actor.schoolId),
      authorize: async () => {
        const batch = await this.requireBatch(input.batchId)
        await this.assertOwner(batch)
      },
      execute: async () => {
        const batch = await this.requireBatch(input.batchId)
        if (batch.state !== 'validated' || batch.revision !== input.revision || batch.previewDigest !== input.previewDigest)
          fail('IMPORT_PREVIEW_STALE')
        const rows = await this.store.listRows(batch.schoolId, batch.id)
        const files = await this.store.listFiles(batch.schoolId, batch.id)
        if ([...new Map(files.map(file => [file.fileId, file])).values()].some(file => file.templateVersion !== IMPORT_TEMPLATE_VERSION))
          fail('IMPORT_TEMPLATE_OBSOLETE')
        const reviewRows = structuredClone(rows)
        const reviewContext = new ImportBusinessContext(this.service, batch, reviewRows, 'validation')
        const reviewDigest = (row: ImportRow) => digestCommandRequest({ mirrors: row.mirroredOfferingIds, references: row.referenceReviews, targetId: row.targetId, expected: row.expectedDigest, proposed: row.proposed, dependencies: [...new Set(row.dependencies)].sort() })
        const before = new Map(await Promise.all(reviewRows.filter(row => row.outcome === 'pending').map(async row => [row.id, await reviewDigest(row)] as const)))
        try {
          for (const reviewed of reviewRows.filter(row => row.outcome === 'pending')) {
            reviewed.resolvedReferences = {}
            reviewed.referenceReviews = {}
            await prepareImportRow(reviewContext, reviewed)
          }
          await this.requireTargetDecisions(reviewContext, reviewRows)
          prepareMirroredOfferingIds(reviewRows)
          await prepareCompleteCollections(reviewContext, reviewRows)
          await validateImportCapacity(reviewContext, reviewRows)
        }
        catch { fail('IMPORT_PREVIEW_STALE') }
        for (const reviewed of reviewRows) {
          if (before.has(reviewed.id) && (reviewed.outcome !== 'pending' || before.get(reviewed.id) !== await reviewDigest(reviewed)))
            fail('IMPORT_PREVIEW_STALE')
        }
        const ready = rows.filter(row => row.outcome === 'pending')
        if (!ready.length)
          fail('IMPORT_NO_READY_ROWS')
        for (const type of new Set(ready.map(row => row.type)))
          await this.policy.assertType(type, true)
        batch.approval = { staffMemberId: actor.staffMemberId, subjectId: actor.subjectId, assuranceLevel: actor.assuranceLevel === 'strong' ? 'strong' : actor.assuranceLevel === 'verified' ? 'verified' : 'standard', authenticatedAt: actor.authenticatedAt.toISOString(), approvedAt: stamp(), revision: batch.revision, previewDigest: input.previewDigest }
        batch.workId = crypto.randomUUID()
        batch.state = 'running'
        batch.updatedAt = stamp()
        await this.store.saveBatch(batch)
        return batch
      },
      persistResult: result => ({ id: result.id }),
      replay: async stored => this.requireBatch(stored.id),
      audit: result => [{ event: 'schoolImportConfirmed', resourceType: 'schoolImports', resourceId: result.id }],
      outbox: result => [{ id: result.workId!, kind: SCHOOL_IMPORT_WORK_KIND, version: 1, resourceType: 'schoolImports', resourceId: result.id }],
    })
  }

  private async requireTargetDecisions(ctx: ImportBusinessContext, rows: ImportRow[]) {
    const named = new Set(['academic_disciplines', 'placement_statuses', 'classes', 'subjects', 'chapters'])
    for (const row of rows) {
      if (!named.has(row.type) || row.current || !row.proposed || row.targetDecision === 'create' || row.outcome !== 'pending')
        continue
      const key = importResources[row.type]
      const data = row.proposed
      const records = new Map((await ctx.list(key)).map(entity => [entity.id, importJson(entity)]))
      for (const other of rows) {
        if (other.type === row.type && other.id !== row.id && other.proposed)
          records.set(other.targetId, other.proposed)
      }
      const matches = [...records].filter(([id, candidate]) => id !== row.targetId
        && (row.type === 'classes' ? ['academicYearId'] : row.type === 'subjects' ? ['academicYearId', 'gradeLevelId'] : row.type === 'chapters' ? ['subjectId'] : []).every(field => candidate[field] === data[field])
        && (normalizeReferenceText(String(candidate['name'] ?? '')) === normalizeReferenceText(String(data['name'] ?? ''))
          || normalizeReferenceText(String(candidate['shortName'] ?? '')) === normalizeReferenceText(String(data['shortName'] ?? ''))))
      if (!matches.length)
        continue
      const candidates: string[] = []
      for (const [id] of matches) {
        // Only persisted, currently readable records may be selected as an update target.
        if (rows.some(other => other.targetId === id && !other.current))
          continue
        try {
          await ctx.readable(key, id)
          candidates.push(id)
        }
        catch (error) {
          if (!(error instanceof BusinessRuleViolationError) || error.code !== 'IMPORT_TARGET_RESTRICTED_OR_MISSING')
            throw error
        }
      }
      row.outcome = 'blocked'
      row.issues.push({ code: 'IMPORT_TARGET_DECISION_REQUIRED', column: 'target', severity: 'error', ...(candidates.length ? { candidates } : {}) })
    }
  }

  async candidates(input: { batchId: string, rowId: string, field: string }) {
    return this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      const rows = await this.store.listRows(batch.schoolId, batch.id)
      const row = rows.find(row => row.id === input.rowId)
      if (!row)
        fail('IMPORT_ROW_ID_UNKNOWN')
      await this.policy.assertType(row.type, true)
      const ctx = new ImportBusinessContext(this.service, batch, rows, 'validation')
      const issue = row.issues.find(issue => issue.column === input.field)
      const ids = issue?.candidates ?? []
      const key = input.field === 'target'
        ? importResources[row.type]
        : (() => {
            try {
              return JSON.parse(input.field)[0] as CoreEntityKey
            }
            catch { fail('IMPORT_RESOLUTION_INVALID') }
          })()
      if (!Object.hasOwn(this.base.repositories, key))
        fail('IMPORT_RESOLUTION_INVALID')
      const candidates: { id: string, name?: string, shortName?: string, identifier?: string }[] = []
      for (const id of ids) {
        const staged = rows.find(other => other.targetId === id && other.proposed && importResources[other.type] === key)
        const data = staged?.proposed ?? importJson(await ctx.readable(key, id))
        candidates.push({ id, ...Object.fromEntries(['name', 'shortName', 'identifier'].flatMap(field => typeof data[field] === 'string' ? [[field, data[field]]] : [])) })
      }
      return { revision: batch.revision, candidates }
    })
  }

  async resolve(input: { batchId: string, revision: number, rowId: string, field: string, targetId?: string, decision?: 'create' | 'update' }) {
    await this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.mutable(batch)
      if (batch.revision !== input.revision)
        fail('IMPORT_PREVIEW_STALE')
      const rows = await this.store.listRows(batch.schoolId, batch.id)
      const row = rows.find(row => row.id === input.rowId)
      if (!row || IMPORT_COMPLETED_OUTCOMES.includes(row.outcome))
        fail('IMPORT_ROW_ID_UNKNOWN')
      await this.policy.assertType(row.type, true)
      if (input.field === 'target') {
        if (!['academic_disciplines', 'placement_statuses', 'classes', 'subjects', 'chapters'].includes(row.type))
          fail('IMPORT_RESOLUTION_INVALID')
        const identity = await this.store.getIdentity(batch.schoolId, row.type, row.sourceKey)
        if (identity?.bound || row.values['target_id'])
          fail('IMPORT_IDENTITY_CONFLICT')
        if (input.decision === 'create') {
          row.targetDecision = 'create'
          if (row.current)
            row.targetId = crypto.randomUUID()
        }
        else if (input.decision === 'update' && input.targetId) {
          await new ImportBusinessContext(this.service, batch).readable(importResources[row.type], input.targetId)
          row.targetDecision = 'update'
          row.targetId = input.targetId
        }
        else {
          fail('IMPORT_RESOLUTION_INVALID')
        }
      }
      else {
        if (!input.targetId || !row.issues.some(issue => issue.column === input.field && issue.candidates?.includes(input.targetId!)))
          fail('IMPORT_RESOLUTION_INVALID')
        row.referenceSelections = { ...row.referenceSelections, [input.field]: input.targetId }
      }
      row.resolvedReferences = {}
      row.referenceReviews = {}
      await this.store.saveRows([row])
      this.invalidate(batch)
      await this.store.saveBatch(batch)
    })
    return this.validate({ batchId: input.batchId })
  }

  async export(input: { type: ImportType, academicYearId: string, after?: string, limit?: number, format?: 'csv' | 'xlsx' }): Promise<{ bytes: Uint8Array, nextCursor: string | null }> {
    return this.atomic(async () => {
      await this.policy.assertType(input.type)
      const year = await this.base.entities.academicYears.findById(input.academicYearId)
      if (!year || year.schoolId !== this.base.actor.schoolId)
        fail('IMPORT_YEAR_INVALID')
      const key = importResources[input.type]
      const scope = await this.base.access.entity(key).readScope()
      const limit = Math.min(500, Math.max(1, input.limit ?? 100))
      const annual = ['classes', 'subjects', 'teacher_assignments', 'billing', 'payments'].includes(input.type)
      let parentFilter = {}
      if (input.type === 'class_offerings') {
        const parents = await this.base.entities.classGroups.list({ academicYearId: input.academicYearId })
        parentFilter = { classGroupId: { $in: parents.map(parent => parent.id) } }
      }
      if (input.type === 'chapters') {
        const parents = await this.base.entities.subjects.list({ academicYearId: input.academicYearId })
        parentFilter = { subjectId: { $in: parents.map(parent => parent.id) } }
      }
      const records = await this.base.repositories[key].forAccess(scope).list({ ...parentFilter, ...(annual ? { academicYearId: input.academicYearId } : {}), ...(input.after ? { id: { $gt: input.after } } : {}), $orderBy: [{ field: 'id', direction: 'asc' }], $limit: limit + 1 } as never)
      const headers = IMPORT_TEMPLATES[input.type].columns.filter(column => !['row_id', 'source_id', '_outcome', '_issues', '_source_file', '_source_row'].includes(column.key))
      const rows = await Promise.all(records.slice(0, limit).map(async (entity) => {
        const data = importJson(entity)
        if (input.type === 'students' || input.type === 'teachers') {
          const profiles = input.type === 'students'
            ? await this.base.entities.studentAcademicYearProfiles.list({ studentId: entity.id, academicYearId: input.academicYearId })
            : await this.base.entities.teacherAcademicYearProfiles.list({ teacherId: entity.id, academicYearId: input.academicYearId })
          const profile = profiles[0]
          if (profile)
            Object.assign(data, Object.fromEntries(Object.entries(importJson(profile)).filter(([field]) => !['id', 'schoolId', 'academicYearId', 'createdAt', 'updatedAt'].includes(field))))
          if (input.type === 'students') {
            const enrollment = (await this.base.entities.enrollments.list({ studentId: entity.id, academicYearId: input.academicYearId, status: StudentClassEnrollmentStatus.Active }))[0]
            if (enrollment)
              Object.assign(data, { classGroupId: enrollment.classGroupId, enrolledAt: enrollment.enrolledAt.toISOString().slice(0, 10) })
          }
        }
        if (input.type === 'teacher_assignments' && typeof data['classSubjectId'] === 'string') {
          const offering = await this.base.entities.classSubjects.findById(data['classSubjectId'])
          if (offering)
            Object.assign(data, { classGroupId: offering.classGroupId, subjectId: offering.subjectId })
        }
        if (input.type === 'chapters' && typeof data['subjectId'] === 'string') {
          const subject = await this.base.entities.subjects.findById(data['subjectId'])
          if (subject)
            data['gradeLevelId'] = subject.gradeLevelId
        }
        if (input.type === 'payments') {
          const account = await this.base.entities.studentYearAccounts.findById(String(data['accountId']))
          if (!account)
            fail('IMPORT_TARGET_RESTRICTED_OR_MISSING')
          data['studentId'] = account.studentId
          data['amount'] = (data['amount'] as Record<string, number>)['amount']!
          data['paymentDate'] = String(data['paymentDate']).slice(0, 10)
        }
        const context: Record<string, string> = {}
        const referenceKeys: Record<string, CoreEntityKey> = { grade: 'gradeLevels', class: 'classGroups', subject: 'subjects', discipline: 'academicDisciplines', category: 'subjectCategories', placement_status: 'placementStatuses', student: 'students', guardian: 'guardians', teacher: 'teachers', catalog_service: 'catalogServices' }
        for (const column of headers.filter(column => column.key.endsWith('_id') && column.field)) {
          const prefix = column.key.slice(0, -3)
          const referenceKey = referenceKeys[prefix]
          const id = data[column.field!]
          if (!referenceKey || typeof id !== 'string')
            continue
          const readableScope = await this.base.access.entity(referenceKey).readScope()
          const reference = await this.base.repositories[referenceKey].forAccess(readableScope).findById(id)
          if (reference) {
            const ref = importJson(reference)
            context[`_${prefix}_label`] = String(ref['name'] ?? [ref['firstName'], ref['lastName']].filter(Boolean).join(' '))
          }
        }
        return headers.map((column) => {
          if (column.key === 'target_id')
            return entity.id
          if (column.key === 'on_existing')
            return ['payments', 'billing'].includes(input.type) ? 'S' : 'M'
          const value = column.field ? data[column.field] : context[column.key] ?? null
          if (column.kind === 'date' && typeof value === 'string')
            return value.slice(0, 10)
          if (Array.isArray(value))
            return value.join(';')
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
            return value
          return null
        })
      }))
      return { bytes: await this.format.serialize({ format: input.format ?? 'xlsx', headers: headers.map(column => column.key), rows }), nextCursor: records.length > limit ? records[limit - 1]!.id : null }
    })
  }

  async retry(input: {
    batchId: string
  }): Promise<ImportDetail> {
    await this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      this.invalidate(batch)
      await this.store.saveBatch(batch)
    })
    return this.validate(input)
  }

  async cancel(input: {
    batchId: string
  }): Promise<ImportBatch> {
    return this.atomic(async () => {
      const batch = await this.requireBatch(input.batchId)
      await this.assertOwner(batch)
      batch.state = 'cancelled'
      batch.updatedAt = stamp()
      const rows = await this.store.listRows(batch.schoolId, batch.id)
      await this.store.saveRows(rows.filter(row => row.outcome === 'pending' || row.outcome === 'failed').map(row => ({ ...row, outcome: 'cancelled' })))
      await this.store.saveBatch(batch)
      return batch
    })
  }

  async detail(id: string): Promise<ImportDetail> {
    return this.atomic(async () => {
      const batch = await this.requireBatch(id)
      const files = await this.store.listFiles(batch.schoolId, batch.id)
      const rows = await this.store.listRows(batch.schoolId, batch.id)
      await this.assertRead(batch, files.map(file => file.type), await this.store.readTargets(batch.schoolId, batch.id))
      const { counts } = await this.store.progress(batch.schoolId, batch.id)
      return { batch, files, rows, counts }
    })
  }

  /** The same current business scopes protect detail, progress and history. */
  private async assertRead(batch: ImportBatch, types: ImportType[], targets: ImportReadTarget[]) {
    for (const type of new Set(types)) await this.policy.assertType(type)
    const requested = new Map<CoreEntityKey, Set<string>>()
    const add = (key: CoreEntityKey, id: string) => {
      const ids = requested.get(key) ?? new Set<string>()
      ids.add(id)
      requested.set(key, ids)
    }
    for (const target of targets) add(importResources[target.type], target.targetId)
    const present = new Map<CoreEntityKey, Set<string>>()
    const check = async (key: CoreEntityKey, ids: readonly string[]) => {
      const repo = this.base.repositories[key]
      if (!repo.forSchool)
        throw new Error('Import reads require school scope')
      const existing = await loadInBatches<CoreEntityMap[CoreEntityKey]>(ids, chunk => repo.forSchool!(batch.schoolId).list({ id: { $in: chunk } } as never))
      const scope = await this.base.access.entity(key).readScope()
      const readable = await loadInBatches<CoreEntityMap[CoreEntityKey]>(existing.map(row => row.id), chunk => repo.forAccess(scope).list({ id: { $in: chunk } } as never))
      if (readable.length !== existing.length)
        throw new ImportBusinessIssue('IMPORT_TARGET_RESTRICTED_OR_MISSING')
      return new Set(existing.map(row => row.id))
    }
    for (const [key, ids] of requested) present.set(key, await check(key, [...ids]))
    requested.clear()
    const requiredStudents = new Set<string>()
    const students = new Set<string>()
    const teachers = new Set<string>()
    const guardians: ImportReadTarget[] = []
    const unmatched = new Set<ImportType>()
    for (const target of targets) {
      if (!present.get(importResources[target.type])?.has(target.targetId)) {
        unmatched.add(target.type)
        continue
      }
      for (const ref of target.references) add(ref.key, ref.id)
      if (target.type === 'students')
        students.add(target.targetId)
      if (target.type === 'teachers')
        teachers.add(target.targetId)
      if (target.type === 'guardians') {
        guardians.push(target)
        for (const id of target.studentIds) {
          add('students', id)
          requiredStudents.add(id)
        }
      }
    }
    for (const type of unmatched) await this.policy.assertUnmatchedRead(batch, type)
    for (const [key, ids] of requested) {
      const existing = await check(key, [...ids])
      if (key === 'students' && [...requiredStudents].some(id => !existing.has(id)))
        throw new ImportBusinessIssue('IMPORT_TARGET_RESTRICTED_OR_MISSING')
    }
    for (const [key, personKey, ids] of [['studentAcademicYearProfiles', 'studentId', students], ['teacherAcademicYearProfiles', 'teacherId', teachers]] as const) {
      if (!ids.size)
        continue
      const repo = this.base.repositories[key]
      const profiles = await loadInBatches<CoreEntityMap['studentAcademicYearProfiles' | 'teacherAcademicYearProfiles']>([...ids], chunk => repo.forSchool!(batch.schoolId).list({ academicYearId: batch.academicYearId, [personKey]: { $in: chunk } }))
      const owners = profiles.map(profile => 'studentId' in profile ? profile.studentId : profile.teacherId)
      if (new Set(owners).size !== owners.length)
        throw new ImportBusinessIssue('IMPORT_MATCH_AMBIGUOUS')
      await check(key, profiles.map(profile => profile.id))
    }
    if (guardians.some(target => target.studentIds.length)) {
      const links = await loadInBatches(guardians.map(target => target.targetId), ids => this.base.repositories.guardianLinks.forSchool!(batch.schoolId).list({ guardianId: { $in: ids } }))
      const pairs = new Set(guardians.flatMap(target => target.studentIds.map(id => JSON.stringify([target.targetId, id]))))
      const relevant = links.filter(link => pairs.has(JSON.stringify([link.guardianId, link.studentId])))
      if (new Set(relevant.map(link => JSON.stringify([link.guardianId, link.studentId]))).size !== relevant.length)
        throw new ImportBusinessIssue('IMPORT_MATCH_AMBIGUOUS')
      await check('guardianLinks', relevant.map(link => link.id))
    }
  }

  async status(id: string): Promise<{ batch: ImportBatch } & ImportProgress> {
    return this.atomic(async () => {
      const batch = await this.requireBatch(id)
      const files = await this.store.listFiles(batch.schoolId, batch.id)
      await this.assertRead(batch, files.map(file => file.type), await this.store.readTargets(batch.schoolId, batch.id))
      return { batch, ...await this.store.progress(batch.schoolId, batch.id) }
    })
  }

  async history(input: {
    limit?: number
    before?: string
  } = {}): Promise<ImportBatch[]> {
    const batches = await this.atomic(async () => {
      await this.policy.assertSession()
      return this.store.listBatches(this.base.actor.schoolId, Math.min(100, input.limit ?? 25), input.before)
    })
    const visible: ImportBatch[] = []
    for (const batch of batches) {
      try {
        visible.push((await this.status(batch.id)).batch)
      }
      catch (error) {
        if (importErrorCode(error) !== 'IMPORT_ACCESS_DENIED' && !(error instanceof ImportBusinessIssue))
          throw error
      }
    }
    return visible
  }

  async report(input: {
    batchId: string
    fileId: string
    format?: 'csv' | 'xlsx'
  }): Promise<Uint8Array> {
    const detail = await this.detail(input.batchId)
    const file = detail.files.filter(file => file.fileId === input.fileId).at(-1)
    if (!file)
      fail('IMPORT_FILE_REFERENCE_INVALID')
    const rows = detail.rows.filter(row => row.source.fileId === file.fileId && row.source.revisionId === file.id)
    const records = rows.map((row) => {
      const values: ImportValues = { ...Object.fromEntries(row.issues.filter(issue => issue.code === 'IMPORT_COLUMN_UNSUPPORTED' && issue.column).map(issue => [issue.column!, row.raw[issue.column!] ?? null])), ...row.values, row_id: row.id, target_id: row.current || IMPORT_COMPLETED_OUTCOMES.includes(row.outcome) ? row.targetId : row.values['target_id'] ?? null, _outcome: row.outcome, _issues: row.issues.map(issue => `${issue.code}${issue.column ? `:${issue.column}` : ''}${issue.replacementColumns ? ` → ${issue.replacementColumns.join(' / ')}` : ''}`).join('; '), _source_file: file.fileName, _source_row: row.source.row }
      if (file.templateVersion === IMPORT_TEMPLATE_VERSION && row.proposed) {
        const reviewedIds = new Set(Object.values(row.resolvedReferences ?? {}))
        for (const column of IMPORT_TEMPLATES[row.type].columns.filter(column => column.field && column.key.endsWith('_id'))) {
          const id = row.proposed[column.field!]
          if (typeof id !== 'string' || !reviewedIds.has(id))
            continue
          const prefix = column.key.slice(0, -3)
          values[column.key] = id
          for (const suffix of ['name', 'short_name', 'identifier']) {
            const key = `${prefix}_${suffix}`
            if (!(key in values))
              continue
            if (values[key])
              values[`_${prefix}_label`] = values[key]!
            values[key] = null
          }
        }
        for (const [idColumn, field, readableColumns] of [['student_ids', 'studentIds', ['student_identifiers']], ['discipline_ids', 'disciplineIds', ['discipline_names', 'discipline_short_names']]] as const) {
          const ids = row.proposed[field]
          if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && reviewedIds.has(id)))
            continue
          values[idColumn] = ids.join(';')
          for (const column of readableColumns) {
            if (column in values)
              values[column] = null
          }
        }
      }
      return values
    })
    const headers = [...new Set(['row_id', 'target_id', 'source_id', 'on_existing', '_outcome', '_issues', '_source_file', '_source_row', ...records.flatMap(values => Object.keys(values))])]
    return this.format.serialize({ format: input.format ?? 'xlsx', headers, rows: records.map(values => headers.map(header => values[header] ?? null)) })
  }

  async template(type: ImportType, format: 'csv' | 'xlsx' = 'xlsx') {
    await this.policy.assertType(type, true)
    return this.format.serialize({ headers: IMPORT_TEMPLATES[type].columns.filter(column => !column.key.startsWith('_')).map(column => column.key), rows: [], format })
  }
}
