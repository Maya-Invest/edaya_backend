import type { ImportFormatPort } from '@edaya/core'
import { PostgresCommandJournal, PostgresImportStore } from '@edaya/adaptor-postgres'
import { createInMemoryFileStorage, Student } from '@edaya/core'
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
  await imports.submit({ batchId: batch.id, type: 'students', fileName: 'students.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['identifier', 'first_name', 'last_name', 'class_id'], rows: Array.from({ length: 22 }, (_, i) => ({ row: i + 2, cells: [`import-${i}`, 'Student', String(i), f.id('class')] })) })) })
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

test('native import targets normalize human identifiers while preserving leading zeros', async () => {
  const f = await fixture('import-normalized')
  await f.r.students.save(new Student({ id: f.id('leading'), schoolId: f.id('school'), identifier: '００１-a', firstName: 'First', lastName: 'Last' }))
  await f.r.students.save(new Student({ id: f.id('ascii'), schoolId: f.id('school'), identifier: ' tutor ', firstName: 'First', lastName: 'Last' }))
  const application = new SchoolApplication({ repositories: f.r, notificationGateway: f.gateway, atomicExecution: f.application.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: f.application.durableWork, importPersistence: new PostgresImportStore(), importFormat: format, fileStorage: createInMemoryFileStorage() })
  const imports = application.forActor(f.editor.baseService.actor).imports
  const batch = await imports.create({ academicYearId: f.id('year') })
  await imports.submit({ batchId: batch.id, type: 'students', fileName: 'people.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['identifier', 'first_name', 'last_name'], rows: [{ row: 2, cells: ['001-a', 'Updated', 'Name'] }, { row: 3, cells: ['tutor', 'Updated', 'Name'] }] })) })
  const preview = await imports.validate({ batchId: batch.id })
  expect(preview.rows.map(row => row.targetId)).toEqual(expect.arrayContaining([f.id('leading'), f.id('ascii')]))
  expect(preview.rows.every(row => row.outcome === 'pending')).toBe(true)
}, 30000)

test('native identifier allocation serializes competing instances and replays a stable attempt', async () => {
  const f = await fixture('import-identifiers')
  const input = { schoolId: f.id('school'), firstName: 'Family', lastName: 'Member', identifier: '001-a', sendAccountInvitation: false }
  const requests = await Promise.allSettled([f.editor, f.other].map((service, index) =>
    service.studentWorkflow.registerGuardian({ ...input, requestId: String(index) })))
  expect(requests.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const empty = await Promise.all([f.editor, f.other].map((service, index) =>
    service.studentWorkflow.registerGuardian({ ...input, identifier: null, requestId: `blank-${index}` })))
  expect(empty[0]!.id).not.toBe(empty[1]!.id)
}, 30000)
