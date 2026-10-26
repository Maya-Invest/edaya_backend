/* eslint dot-notation: "off" -- Import snapshots use index signatures. */
import type { ImportBatch, ImportExecutionOutcome, ImportFileRevision, ImportIdentity, ImportPersistencePort, ImportRow } from '@edaya/core'
import type { SchoolService } from '../../../src/services/school-service'
import { createInMemoryFileStorage, IMPORT_COMPLETED_OUTCOMES, IMPORT_TEMPLATES, StaffMember } from '@edaya/core'
import { expect, test } from 'bun:test'
import { SchoolImportService } from '../../../src/capabilities/imports/import-service'
/** This application test has no SQL, HTTP, spreadsheet or runtime adapter imports. */
function memoryPersistence(): ImportPersistencePort {
  const batches = new Map<string, ImportBatch>()
  const files = new Map<string, ImportFileRevision>()
  const rows = new Map<string, ImportRow>()
  const identities = new Map<string, ImportIdentity>()
  const outcomes = new Map<string, ImportExecutionOutcome>()
  const copy = <T>(value: T) => structuredClone(value)
  const scoped = <T extends {
    schoolId: string
    batchId: string
  }>(map: Map<string, T>,
    school: string,
    batch: string,
  ) => copy([...map.values()].filter(value => value.schoolId === school && value.batchId === batch))
  return {
    getBatch: async (school, id) => copy(batches.get(`${school}:${id}`)),
    listBatches: async school => copy([...batches.values()].filter(batch => batch.schoolId === school)),
    saveBatch: async (batch) => { batches.set(`${batch.schoolId}:${batch.id}`, copy(batch)) },
    addFile: async (file) => { files.set(file.id, copy(file)) },
    listFiles: async (school, batch) => scoped(files, school, batch),
    listRows: async (school, batch) => scoped(rows, school, batch),
    queryRows: async (school, batch, query) => {
      const all = scoped(rows, school, batch)
      return all.filter(row => (!query.ids || query.ids.includes(row.id)) && (!query.outcome || row.outcome === query.outcome) && (!query.after || row.id > query.after)
        && (!query.ready || row.dependencies.every(id => all.some(parent => parent.id === id && IMPORT_COMPLETED_OUTCOMES.includes(parent.outcome))))
        && (!query.dependencyBlocked || row.dependencies.some(id => !all.some(parent => parent.id === id && (parent.outcome === 'pending' || IMPORT_COMPLETED_OUTCOMES.includes(parent.outcome))))))
        .sort((a, b) => (query.ready ? IMPORT_TEMPLATES[a.type].rank - IMPORT_TEMPLATES[b.type].rank : 0) || a.id.localeCompare(b.id))
        .slice(0, query.limit)
    },
    pendingClassCohort: async (school, batch, id) => scoped(rows, school, batch).filter(row => row.type === 'students' && row.outcome === 'pending' && row.proposed?.['classGroupId'] === id && row.current?.['classGroupId'] !== id && !(row.current && row.effectiveMode === 'S')).map(row => ({ id: row.id, targetId: row.targetId })),
    progress: async (school, batch) => {
      const counts: Record<string, number> = {}
      for (const row of scoped(rows, school, batch)) {
        counts[row.outcome] = (counts[row.outcome] ?? 0) + 1
        for (const [key, value] of Object.entries(row.result ?? {})) {
          if (typeof value === 'number')
            counts[key] = (counts[key] ?? 0) + value
        }
      }
      return { counts, version: 0, updatedAt: null }
    },
    readTargets: async (school, batch) => scoped(rows, school, batch).map(row => ({ type: row.type, targetId: row.targetId, references: [], studentIds: [] })),
    exhaustedBatches: async () => [],
    saveRows: async (entries) => {
      for (const row of entries)
        rows.set(row.id, copy(row))
    },
    getIdentity: async (school, type, key) => copy(identities.get(`${school}:${type}:${key}`)),
    saveIdentities: async (entries) => {
      for (const identity of entries) identities.set(`${identity.schoolId}:${identity.type}:${identity.sourceKey}`, copy(identity))
    },
    addOutcomes: async (entries) => {
      for (const outcome of entries) outcomes.set(outcome.operationId, copy(outcome))
    },
    saveIdentity: async (identity) => { identities.set(`${identity.schoolId}:${identity.type}:${identity.sourceKey}`, copy(identity)) },
    findOutcome: async (school, batch, row, digest) => copy([...outcomes.values()].find(outcome => outcome.schoolId === school && outcome.batchId === batch && outcome.rowId === row && outcome.inputDigest === digest)),
    addOutcome: async (outcome) => { outcomes.set(outcome.operationId, copy(outcome)) },
  }
}
test('application staging and matching use only ports, inherit M, preserve false and invalidate settings', async () => {
  const staff = new StaffMember({ id: 'staff', schoolId: 'school', code: '001', firstName: 'Original', lastName: 'Name', phone: '0012', isActive: true })
  const repo = (entities: {
    id: string
  }[]) => ({ forSchool: () => ({ list: async () => entities }), forAccess: () => ({ list: async () => entities, findById: async (id: string) => entities.find(entity => entity.id === id) }) })
  const actor = { kind: 'staff', accountKind: 'human', schoolId: 'school', staffMemberId: 'owner', subjectId: 'subject' }
  const repositories = new Proxy({ staffMembers: repo([staff]), privateFiles: { reserve: async () => { }, retain: async () => { } } }, { get: (target, property) => Reflect.get(target, property) ?? repo([]) })
  const service = { baseService: { actor, access: { forOperation: () => service.baseService.access, actor, assertSchool: async () => { }, scope: async () => ({}), entity: () => ({ readScope: async () => ({}), assertSave: async () => { } }) }, atomicExecution: { execute: async (run: () => Promise<unknown>) => run() }, entities: { academicYears: { findById: async () => ({ id: 'year', schoolId: 'school' }) } }, repositories, fileStorage: createInMemoryFileStorage() } } as unknown as SchoolService
  const imports = new SchoolImportService(service, memoryPersistence(), { parse: async () => ({ headers: ['code', 'first_name', 'phone', 'is_active', 'on_existing'], rows: [{ row: 2, cells: ['001', 'Compound First Name', '', false, ' m '] }] }), serialize: async () => new Uint8Array() })
  const batch = await imports.create({ academicYearId: 'year' })
  expect(batch.defaultOnExisting).toBe('M')
  await imports.submit({ batchId: batch.id, fileName: 'staff.csv', bytes: new Uint8Array([1]), type: 'staff' })
  const preview = await imports.validate({ batchId: batch.id })
  expect(preview.rows[0]!.proposed).toMatchObject({ firstName: 'Compound First Name', lastName: 'Name', phone: '0012', isActive: false })
  expect(preview.rows[0]!.effectiveMode).toBe('M')
  expect(preview.batch.previewDigest).toBeString()
  const updated = await imports.settings({ batchId: batch.id, defaultOnExisting: 'O' })
  expect(updated.previewDigest).toBeNull()
  expect(updated.state).toBe('draft')
})
