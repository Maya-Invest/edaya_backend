/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { CoreEntityKey, CoreEntityMap, ImportBatch, ImportExistingMode, ImportFileRevision, ImportFormatPort, ImportPersistencePort, ImportProgress, ImportReadTarget, ImportRow, ImportType } from '@edaya/core'
import type { SchoolService } from '../../services/school-service'
import { ImportAccessPolicy, importResources } from '@edaya/authorization'
import { BusinessRuleViolationError, IMPORT_COMPLETED_OUTCOMES, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, IMPORT_TEMPLATE_VERSION, IMPORT_TEMPLATES, parseImportDate, resolveImportExistingMode } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { loadInBatches } from '../shared/bounded-reads'
import { ImportBusinessContext, ImportBusinessIssue, prepareImportRow, validateImportCapacity } from './business'
import { prepareCompleteCollections } from './collections'
import { importErrorCode, normalizeImportTable, normalizeImportValues } from './normalization'

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
      const seen = new Set<string>()
      const rows: ImportRow[] = []
      for (const parsedRow of normalized) {
        const requested = String(parsedRow.values['row_id'] ?? '').trim()
        const previous = requested ? previousRows.find(row => row.id === requested && row.source.fileId === file.fileId) : undefined
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
        const identity = await this.store.getIdentity(batch.schoolId, file.type, sourceKey)
        const knownTargetId = String(parsedRow.values['target_id'] ?? '').trim() || identity?.targetId || previous?.targetId
        const resource = file.type === 'teachers' ? 'teachers' : file.type === 'guardians' ? 'guardians' : null
        const knownPerson = resource && knownTargetId ? await this.base.repositories[resource].forAccess(await this.base.access.entity(resource).readScope()).findById(knownTargetId) : undefined
        const needsCode = Boolean(resource && !knownPerson && !String(parsedRow.values['code'] ?? '').trim())
        const generatedCode = needsCode ? identity?.generatedCode ?? previous?.generatedCode ?? `${file.type === 'teachers' ? 'T' : 'G'}-${crypto.randomUUID()}` : null
        const row: ImportRow = { id, batchId: batch.id, schoolId: batch.schoolId, type: file.type, source: { fileId: file.fileId, revisionId: file.id, row: parsedRow.sourceRow, ...(parsed.sheet ? { sheet: parsed.sheet } : {}) }, raw: parsedRow.raw, values: { ...parsedRow.values, row_id: id, ...(generatedCode ? { code: generatedCode } : {}) }, generatedCode, targetId: identity?.targetId ?? previous?.targetId ?? crypto.randomUUID(), sourceKey, effectiveMode: batch.defaultOnExisting, inputDigest: '', operationId: crypto.randomUUID(), dependencies: [], current: null, proposed: null, expectedDigest: null, issues: parsedRow.issues, outcome: parsedRow.issues.length ? 'blocked' : 'pending', result: null }
        await this.store.saveIdentity({ schoolId: batch.schoolId, type: file.type, sourceKey, targetId: row.targetId, generatedCode, bound: identity?.bound ?? false })
        rows.push(row)
      }
      // Missing rows on a replacement are retained as history, never executed accidentally.
      const removed = previousRows.filter(row => row.source.fileId === file.fileId && !seen.has(row.id) && !IMPORT_COMPLETED_OUTCOMES.includes(row.outcome)).map(row => ({ ...row, outcome: 'cancelled' as const }))
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
      const ctx = new ImportBusinessContext(this.service, batch, rows, 'validation')
      for (const row of rows) {
        row.issues = row.issues.filter(issue => issue.code === 'IMPORT_COLUMN_UNSUPPORTED')
        row.proposed = null
        row.current = null
        row.dependencies = []
        row.result = null
        try {
          row.effectiveMode = resolveImportExistingMode(row.values['on_existing'], batch.defaultOnExisting)
          if (row.issues.length) {
            row.outcome = 'blocked'
            continue
          }
          await prepareImportRow(ctx, row)
          const identity = await this.store.getIdentity(batch.schoolId, row.type, row.sourceKey)
          if (identity?.bound && identity.targetId !== row.targetId)
            fail('IMPORT_IDENTITY_CONFLICT')
          row.inputDigest = await digestCommandRequest({ type: row.type, values: normalizeImportValues(row.type, row.values), sourceKey: row.sourceKey, mode: row.effectiveMode, academicYearId: batch.academicYearId, enrollmentEffectiveDate: batch.enrollmentEffectiveDate })
          const previous = await this.store.findOutcome(batch.schoolId, batch.id, row.id, row.inputDigest)
          if (previous && IMPORT_COMPLETED_OUTCOMES.includes(previous.outcome)) {
            row.outcome = previous.outcome
            row.targetId = previous.targetId
            row.result = previous.result
            row.operationId = previous.operationId
          }
          else {
            row.operationId = crypto.randomUUID()
          }
        }
        catch (error) {
          const code = importErrorCode(error)
          if (code === 'IMPORT_TRANSIENT_FAILURE')
            throw error
          row.outcome = code === 'IMPORT_DEPENDENCY_BLOCKED' ? 'dependency_blocked' : 'blocked'
          row.issues.push({ code, severity: 'error', ...(error instanceof ImportBusinessIssue && error.candidates.length ? { candidates: error.candidates } : {}), ...(code === 'IMPORT_ON_EXISTING_INVALID' ? { column: 'on_existing' } : {}) })
        }
      }
      const identities = new Map<string, ImportRow[]>()
      for (const row of rows.filter(row => row.proposed)) {
        const data = row.proposed!
        const fields: Record<ImportType, string[]> = {
          academic_disciplines: ['code'],
          placement_statuses: ['code'],
          students: ['matricule'],
          teachers: ['code'],
          guardians: ['code'],
          staff: ['code'],
          classes: ['gradeLevelId', 'name'],
          subjects: ['gradeLevelId', data['code'] ? 'code' : 'name'],
          guardian_relationships: ['guardianId', 'studentId'],
          class_offerings: ['classGroupId', 'subjectId'],
          teacher_assignments: ['teacherId', 'kind', 'classGroupId', 'subjectId'],
          chapters: ['subjectId', 'sequenceOrder'],
          billing: ['studentId', 'catalogServiceId'],
          payments: ['reference'],
        }
        const keys = [`${row.type}:business:${fields[row.type].map(field => String(data[field] ?? '').trim().toLocaleLowerCase()).join('\0')}`]
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
    const headers = [...new Set(['row_id', 'target_id', 'source_id', 'on_existing', '_outcome', '_issues', '_source_file', '_source_row', ...detail.rows.filter(row => row.source.fileId === file.fileId).flatMap(row => Object.keys(row.values)), ...detail.rows.filter(row => row.source.fileId === file.fileId).flatMap(row => row.issues.filter(issue => issue.code === 'IMPORT_COLUMN_UNSUPPORTED' && issue.column).map(issue => issue.column!))])]
    return this.format.serialize({ format: input.format ?? 'xlsx', headers, rows: detail.rows.filter(row => row.source.fileId === file.fileId).map((row) => {
      const values = { ...row.raw, ...row.values, row_id: row.id, target_id: row.current || IMPORT_COMPLETED_OUTCOMES.includes(row.outcome) ? row.targetId : row.values['target_id'] ?? null, _outcome: row.outcome, _issues: row.issues.map(issue => `${issue.code}${issue.column ? `:${issue.column}` : ''}${issue.candidates?.length ? ` [${issue.candidates.join(', ')}]` : ''}`).join('; '), _source_file: file.fileName, _source_row: row.source.row }
      return headers.map(header => values[header as keyof typeof values] ?? null)
    }) })
  }

  async template(type: ImportType, format: 'csv' | 'xlsx' = 'xlsx') {
    await this.policy.assertType(type, true)
    return this.format.serialize({ headers: IMPORT_TEMPLATES[type].columns.filter(column => !column.key.startsWith('_')).map(column => column.key), rows: [], format })
  }
}
