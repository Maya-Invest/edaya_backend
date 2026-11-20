import type { ImportFormatPort, ParsedImportTable } from '@edaya/core'
import { createInMemoryFileStorage, GradeLevel, noOpNotificationGateway, withShortName } from '@edaya/core'
import { dispatchSchoolImports, SchoolApplication } from '@edaya/service'
import { expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresImportStore } from '../../../../adaptor-postgres/src/stores/import-store'
import { createTestApp } from '../../support/create-test-app'

const format: ImportFormatPort = {
  parse: async ({ bytes }) => JSON.parse(new TextDecoder().decode(bytes)) as ParsedImportTable,
  serialize: async input => new TextEncoder().encode(JSON.stringify(input)),
}

test('all staged duplicate catalog names require an explicit creation decision', async () => {
  const f = await fixture()
  await f.submit('academic_disciplines', ['source_id', 'name', 'short_name'], [['a', 'Science', 'SCI'], ['b', 'Science', 'SCI']])
  let preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows.every(row => row.issues.some(issue => issue.code === 'IMPORT_TARGET_DECISION_REQUIRED'))).toBe(true)
  for (const row of preview.rows) preview = await f.imports.resolve({ batchId: f.batch.id, revision: preview.batch.revision, rowId: row.id, field: 'target', decision: 'create' })
  expect(preview.rows.every(row => row.outcome === 'pending')).toBe(true)
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect(await f.schoolRepositories.academicDisciplines.count()).toBe(2)
}, 60000)

test('non-human updates require selection and exported IDs survive display renames', async () => {
  const f = await fixture()
  const existing = await f.service.academicsWorkflow.configureAcademicDiscipline({ id: 'science', name: 'Science', shortName: 'SCI' })
  await f.submit('academic_disciplines', ['source_id', 'name'], [['external-science', 'Science']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  const row = preview.rows[0]!
  expect(row.outcome).toBe('blocked')
  expect((await f.imports.candidates({ batchId: f.batch.id, rowId: row.id, field: 'target' })).candidates.map(candidate => candidate.id)).toEqual([existing.id])
  const chosen = await f.imports.resolve({ batchId: f.batch.id, revision: preview.batch.revision, rowId: row.id, field: 'target', decision: 'update', targetId: existing.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: chosen.batch.revision, previewDigest: chosen.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  const exported = await f.imports.export({ type: 'academic_disciplines', academicYearId: 'year', format: 'csv' })
  const table = JSON.parse(new TextDecoder().decode(exported.bytes)) as { headers: string[], rows: string[][] }
  expect(table.rows[0]![table.headers.indexOf('target_id')]).toBe('science')
  await f.service.academicsWorkflow.configureAcademicDiscipline({ id: 'science', name: 'Renamed' })
  const next = await f.imports.create({ academicYearId: 'year' })
  await f.imports.submit({ batchId: next.id, type: 'academic_disciplines', fileName: 'roundtrip.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: table.headers, rows: table.rows.map((cells, index) => ({ row: index + 2, cells })) })) })
  const roundtrip = await f.imports.validate({ batchId: next.id })
  expect(roundtrip.rows[0]?.targetId).toBe('science')
  expect(roundtrip.rows[0]?.outcome).toBe('pending')
  expect(await f.schoolRepositories.academicDisciplines.count()).toBe(1)
}, 60000)

test('changed automatic candidate sets require renewed review', async () => {
  const f = await fixture()
  await f.service.setupWorkflow.configureGradeLevel({ id: 'first', schoolId: 'school', name: 'Sixième', shortName: '6e', order: 1 })
  await f.submit('classes', ['source_id', 'name', 'grade_short_name'], [['class-a', 'Class A', '6e']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows[0]?.outcome).toBe('pending')
  await f.service.setupWorkflow.configureGradeLevel({ id: 'second', schoolId: 'school', name: 'Sixième bilingue', shortName: '6e', order: 2 })
  await expect(f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_STALE' })
  expect(await f.schoolRepositories.classGroups.count()).toBe(0)
}, 60000)

test('catalog short names survive omitted updates and allow duplicates', async () => {
  const f = await fixture()
  await f.service.academicsWorkflow.configureSubjectCategory({ id: 'a', name: 'An unusually long display name used only for this test' })
  const before = (await f.schoolRepositories.subjectCategories.findById('a'))!
  expect(Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(before.shortName)).length).toBe(32)
  await f.service.academicsWorkflow.configureSubjectCategory({ id: 'a', name: 'Renamed' })
  expect((await f.schoolRepositories.subjectCategories.findById('a'))?.shortName).toBe(before.shortName)
  await f.service.academicsWorkflow.configureSubjectCategory({ id: 'b', name: 'Renamed', shortName: before.shortName })
  expect(await f.schoolRepositories.subjectCategories.count()).toBe(2)
  await expect(f.service.academicsWorkflow.configureSubjectCategory({ id: 'a', name: 'Renamed', shortName: 'x'.repeat(33) })).rejects.toThrow()
}, 60000)
async function fixture() {
  const f = await createTestApp()
  const application = new SchoolApplication({ repositories: f.schoolRepositories, atomicExecution: f.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: f.durableWork, importPersistence: new PostgresImportStore(), importFormat: format, notificationGateway: noOpNotificationGateway, fileStorage: createInMemoryFileStorage(), accountInvitationsEnabled: false })
  const service = application.forActor(f.app.baseService.actor)
  await service.setupWorkflow.createAcademicYear({ id: 'year', schoolId: 'school', name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
  await service.setupWorkflow.publishAcademicYear({ academicYearId: 'year' })
  const imports = service.imports
  const batch = await imports.create({ academicYearId: 'year' })
  const submit = (type: Parameters<typeof imports.submit>[0]['type'], headers: string[], cells: string[][]) => imports.submit({ batchId: batch.id, type, fileName: `${type}.csv`, bytes: new TextEncoder().encode(JSON.stringify({ headers, rows: cells.map((cells, index) => ({ row: index + 2, cells })) })) })
  return { ...f, application, service, imports, batch, submit }
}

test('human creation replays, corrects with retirement, and restores its own identifier', async () => {
  const f = await fixture()
  const input = { requestId: 'manual', schoolId: 'school', identifier: ' ００１-a ', firstName: 'Ada', lastName: 'Lovelace', sendAccountInvitation: false }
  const created = await f.service.studentWorkflow.registerStudent(input)
  expect((await f.service.studentWorkflow.registerStudent(input)).id).toBe(created.id)
  await expect(f.service.studentWorkflow.registerStudent({ ...input, lastName: 'Changed' })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
  await f.service.setupWorkflow.correctHumanIdentifier({ group: 'students', entityId: created.id, expectedIdentifier: '001-A', identifier: '002', requestId: 'correction-one' })
  const second = await f.service.studentWorkflow.registerStudent({ ...input, requestId: 'second' })
  expect(second.identifier).toBe('001-A')
  const cleared = await f.service.setupWorkflow.correctHumanIdentifier({ group: 'students', entityId: created.id, expectedIdentifier: '002', identifier: null, requestId: 'clear' })
  expect(cleared.identifier).toBeNull()
  expect((await f.schoolRepositories.students.findById(created.id))?.identifier).toBeUndefined()
  const teacher = await f.service.setupWorkflow.registerTeacher({ ...input, requestId: 'teacher' })
  expect(teacher.identifier).toBe('001-A')
}, 60000)

test('ambiguous references require a decision and execute against the reviewed ID after a rename', async () => {
  const f = await fixture()
  for (const id of ['grade-a', 'grade-b']) await f.service.baseService.entities.gradeLevels.save(new GradeLevel(withShortName({ id, schoolId: 'school', name: 'Sixième', shortName: '6e', order: 1 })))
  await f.submit('classes', ['source_id', 'name', 'grade_name'], [['class-a', 'Class A', 'SIXIÈME']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  const row = preview.rows[0]!
  const issue = row.issues.find(issue => issue.code === 'IMPORT_REFERENCE_AMBIGUOUS')!
  expect(issue.candidates?.sort()).toEqual(['grade-a', 'grade-b'])
  const resolved = await f.imports.resolve({ batchId: f.batch.id, revision: preview.batch.revision, rowId: row.id, field: issue.column!, targetId: 'grade-b' })
  expect(resolved.rows[0]?.outcome).toBe('pending')
  await f.imports.confirm({ batchId: f.batch.id, revision: resolved.batch.revision, previewDigest: resolved.batch.previewDigest! })
  const grade = (await f.schoolRepositories.gradeLevels.findById('grade-b'))!
  await f.service.baseService.entities.gradeLevels.save(grade.copyWith({ name: 'Renamed after approval' }))
  await dispatchSchoolImports(f.application)
  const result = await f.imports.detail(f.batch.id)
  expect(result.rows[0]?.issues).toEqual([])
  expect(result.rows[0]?.outcome).toBe('created')
  expect((await f.schoolRepositories.classGroups.findById(row.targetId))?.gradeLevelId).toBe('grade-b')
  expect((await f.schoolRepositories.gradeLevels.findById('grade-b'))?.shortName).toBe('6e')
}, 60000)

test('a correction download preserves an absent human identifier and reviewed reference IDs', async () => {
  const f = await fixture()
  await f.service.setupWorkflow.configureGradeLevel({ id: 'grade', schoolId: 'school', name: 'Sixième', shortName: '6e', order: 1 })
  await f.service.setupWorkflow.createClassGroup({ id: 'class', schoolId: 'school', academicYearId: 'year', gradeLevelId: 'grade', name: 'Sixième A' })
  const file = await f.submit('students', ['source_id', 'first_name', 'last_name', 'class_name', 'enrollment_effective_date'], [['external-child', 'Ada', 'Lovelace', 'Sixième A', '2026-01-01']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows[0]?.issues).toEqual([])
  expect(preview.rows[0]?.outcome).toBe('pending')
  const table = JSON.parse(new TextDecoder().decode(await f.imports.report({ batchId: f.batch.id, fileId: file.fileId }))) as { headers: string[], rows: string[][] }
  expect(table.rows[0]![table.headers.indexOf('class_id')]).toBe('class')
  expect(table.rows[0]![table.headers.indexOf('class_name')]).toBeNull()
  await f.service.setupWorkflow.updateClassGroupConfiguration({ classGroupId: 'class', name: 'Renamed class' })
  await f.imports.submit({ batchId: f.batch.id, fileId: file.fileId, type: 'students', fileName: 'corrected.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: table.headers, rows: table.rows.map((cells, index) => ({ row: index + 2, cells })) })) })
  const corrected = await f.imports.validate({ batchId: f.batch.id })
  expect(corrected.rows[0]?.issues).toEqual([])
  expect(corrected.rows[0]?.targetId).toBe(preview.rows[0]?.targetId)
  const { identifier } = preview.rows[0]?.proposed ?? {}
  expect(identifier).toBeUndefined()
  expect(corrected.rows[0]?.proposed).not.toHaveProperty('identifier')
  await f.imports.confirm({ batchId: f.batch.id, revision: corrected.batch.revision, previewDigest: corrected.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).rows[0]?.outcome).toBe('created')
}, 60000)

test('obsolete identification columns are rejected even when blank and include v2 correction guidance', async () => {
  const f = await fixture()
  await f.submit('staff', ['source_id', 'code', 'first_name', 'last_name'], [['external', '', 'Ada', 'Lovelace']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows[0]?.outcome).toBe('blocked')
  expect(preview.rows[0]?.issues).toContainEqual({ code: 'IMPORT_COLUMN_UNSUPPORTED', column: 'code', severity: 'error', replacementColumns: ['identifier'] })
}, 60000)
