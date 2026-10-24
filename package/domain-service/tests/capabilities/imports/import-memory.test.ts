import type { ImportBatch, ImportExecutionOutcome, ImportFileRevision, ImportIdentity, ImportPersistencePort, ImportRow } from '@edaya/core'
import type { SchoolService } from '../../../src/services/school-service'
import { createInMemoryFileStorage, StaffMember } from '@edaya/core'
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
    saveRows: async (entries) => {
      for (const row of entries)
        rows.set(row.id, copy(row))
    },
    getIdentity: async (school, type, key) => copy(identities.get(`${school}:${type}:${key}`)),
    saveIdentity: async (identity) => { identities.set(`${identity.schoolId}:${identity.type}:${identity.sourceKey}`, copy(identity)) },
    findOutcome: async (school, batch, row, digest) => copy([...outcomes.values()].find(outcome => outcome.schoolId === school && outcome.batchId === batch && outcome.rowId === row && outcome.inputDigest === digest)),
    addOutcome: async (outcome) => { outcomes.set(outcome.operationId, copy(outcome)) },
  }
}
test('application staging and matching use only ports, inherit M, preserve false and invalidate settings', async () => {
  const staff = new StaffMember({ id: 'staff', schoolId: 'school', code: '001', firstName: 'Original', lastName: 'Name', phone: '0012', isActive: true })
  const repo = (entities: {
    id: string
  }[]) => ({ forSchool: () => ({ list: async () => entities }), forAccess: () => ({ findById: async (id: string) => entities.find(entity => entity.id === id) }) })
  const actor = { kind: 'staff', accountKind: 'human', schoolId: 'school', staffMemberId: 'owner', subjectId: 'subject' }
  const repositories = new Proxy({ staffMembers: repo([staff]), privateFiles: { reserve: async () => { }, retain: async () => { } } }, { get: (target, property) => Reflect.get(target, property) ?? repo([]) })
  const service = { baseService: { actor, access: { actor, assertSchool: async () => { }, scope: async () => ({}), entity: () => ({ readScope: async () => ({}), assertSave: async () => { } }) }, atomicExecution: { execute: async (run: () => Promise<unknown>) => run() }, entities: { academicYears: { findById: async () => ({ id: 'year', schoolId: 'school' }) } }, repositories, fileStorage: createInMemoryFileStorage() } } as unknown as SchoolService
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
