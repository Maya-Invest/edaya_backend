import type { ImportFormatPort } from '@edaya/core'
import { PostgresCommandJournal, PostgresImportStore } from '@edaya/adaptor-postgres'
import { createInMemoryFileStorage, Guardian, Student } from '@edaya/core'
import { dispatchSchoolImports, SchoolApplication } from '@edaya/service'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

const format: ImportFormatPort = {
  parse: async ({ bytes }) => JSON.parse(new TextDecoder().decode(bytes)),
  serialize: async value => new TextEncoder().encode(JSON.stringify(value)),
}

test('native import batches preserve progress across concurrent dispatch, replay and rollback', async () => {
  const f = await fixture('import-progress')
  const application = new SchoolApplication({ repositories: f.r, notificationGateway: f.gateway, atomicExecution: f.application.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: f.application.durableWork, importPersistence: new PostgresImportStore(), importFormat: format, fileStorage: createInMemoryFileStorage() })
  const imports = application.forActor(f.editor.baseService.actor).imports
  const batch = await imports.create({ academicYearId: f.id('year'), enrollmentEffectiveDate: '2026-01-01' })
  await imports.submit({ batchId: batch.id, type: 'students', fileName: 'students.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['matricule', 'first_name', 'last_name', 'class'], rows: Array.from({ length: 22 }, (_, i) => ({ row: i + 2, cells: [`import-${i}`, 'Student', String(i), f.id('class')] })) })) })
  const preview = await imports.validate({ batchId: batch.id })
  const confirmation = { batchId: batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! }
  await imports.confirm(confirmation)
  await Promise.all([dispatchSchoolImports(application, { maxPages: 100 }), dispatchSchoolImports(application, { maxPages: 100 })])
  const status = await imports.status(batch.id)
  expect(status.batch.state).toBe('completed')
  expect(status.counts).toEqual({ created: 22, studentsRegistered: 22, studentsEnrolled: 22 })
  expect(await f.r.subjectEnrollments.count({ classSubjectId: f.id('subject') })).toBe(23)
  expect((await f.r.classSubjects.findById(f.id('subject')))?.participationRevision).toBe(22)
  await imports.confirm(confirmation)
  await dispatchSchoolImports(application)
  expect(await imports.status(batch.id)).toEqual(status)
  const detail = await imports.detail(batch.id)
  await expect(application.atomicExecution.execute(async () => {
    await application.importPersistence.saveRows([{ ...detail.rows[0]!, outcome: 'failed', result: null }])
    throw new Error('rollback')
  })).rejects.toThrow('rollback')
  expect(await imports.status(batch.id)).toEqual(status)
}, 30000)

test('native normalized import predicates preserve Unicode case and compatibility matching', async () => {
  const f = await fixture('import-unicode')
  await f.r.students.save(new Student({ id: f.id('unicode'), schoolId: f.id('school'), matricule: '\u00A0ＭＡＴ-É\u00A0', firstName: 'First', lastName: 'Last' }))
  await f.r.students.save(new Student({ id: f.id('other-unicode'), schoolId: f.id('school'), matricule: 'ÉCOLE', firstName: 'Other', lastName: 'Student' }))
  await f.r.students.save(new Student({ id: f.id('ascii'), schoolId: f.id('school'), matricule: '\t tutor \n', firstName: 'First', lastName: 'Last' }))
  const application = new SchoolApplication({ repositories: f.r, notificationGateway: f.gateway, atomicExecution: f.application.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: f.application.durableWork, importPersistence: new PostgresImportStore(), importFormat: format, fileStorage: createInMemoryFileStorage() })
  const imports = application.forActor(f.editor.baseService.actor).imports
  const batch = await imports.create({ academicYearId: f.id('year') })
  await imports.submit({ batchId: batch.id, type: 'students', fileName: 'unicode.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['matricule', 'first_name', 'last_name'], rows: [{ row: 2, cells: ['mat-é', 'Updated', 'Name'] }, { row: 3, cells: ['tutor', 'Updated', 'Name'] }] })) })
  const preview = await imports.validate({ batchId: batch.id })
  expect(preview.rows.map(row => row.targetId)).toEqual(expect.arrayContaining([f.id('unicode'), f.id('ascii')]))
  expect(preview.rows.every(row => row.outcome === 'pending')).toBe(true)
}, 30000)

test('native guardian uniqueness narrows candidates but retains Unicode rules and concurrent database conflicts', async () => {
  const f = await fixture('import-person-code')
  const guardian = (id: string, code: string) => new Guardian({ id: f.id(id), schoolId: f.id('school'), code, firstName: 'First', lastName: 'Parent' })
  const save = (id: string, code: string) => f.editor.baseService.entities.guardians.save(guardian(id, code))
  await save('unicode', 'ÉCOLE')
  await expect(save('unicode-duplicate', '\u00A0école\u00A0')).rejects.toMatchObject({ code: 'GUARDIAN_CODE_ALREADY_EXISTS' })
  await save('ascii', 'CODE')
  await expect(save('ascii-duplicate', '\t code \n')).rejects.toMatchObject({ code: 'GUARDIAN_CODE_ALREADY_EXISTS' })
  await save('compatibility', 'ＣＯＤＥ')
  await save('ascii', 'code')
  const attempts = await Promise.allSettled([
    save('race-one', 'RACE'),
    f.other.baseService.entities.guardians.save(guardian('race-two', 'RACE')),
  ])
  expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(await f.r.guardians.count({ schoolId: f.id('school'), code: 'RACE' })).toBe(1)
}, 30000)
