/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { ImportFormatPort, ParsedImportTable } from '@edaya/core'
import { BusinessRuleViolationError, CatalogServiceStatus, ClassGroup, createInMemoryFileStorage, Guardian, GuardianStudentLink, noOpNotificationGateway, StaffMember, Student, StudentClassEnrollment, StudentClassEnrollmentStatus, withShortName } from '@edaya/core'
import { dispatchAutoBilling, dispatchSchoolImports, SchoolApplication } from '@edaya/service'
import { expect, spyOn, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresImportStore } from '../../../../adaptor-postgres/src/stores/import-store'
import { ImportBusinessContext } from '../../../src/capabilities/imports/business'
import { createStudentTransitionContext } from '../../services/workflows/student-workflow-context'
// Application tests drive the parsing port, not a spreadsheet implementation.
const format: ImportFormatPort = { parse: async ({ bytes }) => JSON.parse(new TextDecoder().decode(bytes)) as ParsedImportTable, serialize: async data => new TextEncoder().encode(JSON.stringify(data)) }
test('identity staging and replay lookup stay batched and retain duplicate-source detection', async () => {
  const f = await fixture()
  const store = f.application.importPersistence
  const individual = [spyOn(store, 'getIdentity'), spyOn(store, 'saveIdentity'), spyOn(store, 'findOutcome')]
  const batched = [spyOn(store, 'getIdentities'), spyOn(store, 'saveIdentities'), spyOn(store, 'findOutcomes')]
  try {
    await f.submit('guardians', ['source_id', 'identifier', 'first_name', 'last_name'], Array.from({ length: 24 }, (_, i) => [`source-${i}`, `G-${i}`, 'First', 'Last']))
    const preview = await f.imports.validate({ batchId: f.batch.id })
    expect(preview.counts['pending']).toBe(24)
    for (const read of individual) expect(read).not.toHaveBeenCalled()
    expect(batched[0]).toHaveBeenCalledTimes(2)
    expect(batched[1]).toHaveBeenCalledTimes(2)
    expect(batched[2]).toHaveBeenCalledTimes(1)
  }
  finally {
    for (const call of [...individual, ...batched]) call.mockRestore()
  }
  const duplicate = await fixture()
  await duplicate.submit('guardians', ['source_id', 'first_name', 'last_name'], [['same', 'One', 'Parent'], ['same', 'Two', 'Parent']])
  const preview = await duplicate.imports.validate({ batchId: duplicate.batch.id })
  expect(new Set(preview.rows.map(row => row.targetId)).size).toBe(1)
  expect(preview.rows.every(row => row.outcome === 'blocked')).toBe(true)
})

async function fixture() {
  const original = await createStudentTransitionContext()
  const application = new SchoolApplication({ repositories: original.repositories, atomicExecution: original.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: original.durableWork, fileStorage: createInMemoryFileStorage(), notificationGateway: noOpNotificationGateway, importPersistence: new PostgresImportStore(), importFormat: format })
  const service = application.forActor(original.service.baseService.actor)
  const imports = service.imports
  const batch = await imports.create({ academicYearId: 'ay1', enrollmentEffectiveDate: '2025-09-01' })
  const submit = async (type: Parameters<typeof imports.submit>[0]['type'], headers: string[], values: (string | number | boolean | null)[][]) => imports.submit({ batchId: batch.id, type, fileName: `${type}.csv`, bytes: new TextEncoder().encode(JSON.stringify({ headers, rows: values.map((cells, i) => ({ row: i + 2, cells })) })) })
  const run = async () => {
    const detail = await imports.validate({ batchId: batch.id })
    expect(detail.rows.filter(row => row.outcome === 'blocked').map(row => row.issues)).toEqual([])
    await imports.confirm({ batchId: batch.id, revision: detail.batch.revision, previewDigest: detail.batch.previewDigest! })
    for (let i = 0; i < 10; i++) {
      await dispatchSchoolImports(application)
      if ((await imports.detail(batch.id)).batch.state !== 'running')
        break
    }
    return imports.detail(batch.id)
  }
  return { ...original, application, service, imports, batch, submit, run }
}
test('default merge preserves names and staff phone, persists background outcomes, and replays without duplicates', async () => {
  const f = await fixture()
  expect(f.batch.defaultOnExisting).toBe('M')
  await f.submit('staff', ['identifier', 'first_name', 'last_name', 'phone'], [['001', 'Compound First', 'Compound Last', '+225 0001']])
  const complete = await f.run()
  expect(complete.rows.map(row => [row.outcome, row.issues])).toEqual([['created', []]])
  expect((await f.repositories.staffMembers.findById(complete.rows[0]!.targetId))?.phone).toBe('+225 0001')
  const again = await f.imports.validate({ batchId: f.batch.id })
  expect(again.counts['created']).toBe(1)
  expect(await f.repositories.staffMembers.count({ identifier: '001' })).toBe(1)
})
test('invalid mode blocks a row and changing session settings invalidates confirmation', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'on_existing'], [['001', 'New', 'Student', 'bad'], ['002', 'Other', 'Student', ' m ']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.counts['blocked']).toBe(1)
  expect(preview.rows.find(row => row.outcome === 'blocked')?.issues[0]?.code).toBe('IMPORT_ON_EXISTING_INVALID')
  await f.imports.settings({ batchId: f.batch.id, defaultOnExisting: 'S' })
  await expect(f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_STALE' })
})
test('skipped people resolve dependent identity and class placement commits atomically', async () => {
  const f = await fixture()
  await f.repositories.students.save(new Student({ id: 'already', schoolId: 'sch1', firstName: 'Old', lastName: 'Student', identifier: '001' }))
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id', 'is_repeating', 'on_existing'], [['001', 'Ignored', 'Name', null, false, 'S'], ['002', 'New', 'Student', 'cg1', false, 'M']])
  const result = await f.run()
  expect(result.rows.map(row => ({ outcome: row.outcome, issues: row.issues }))).toEqual(expect.arrayContaining([{ outcome: 'skipped', issues: [] }]))
  expect(result.counts['skipped']).toBe(1)
  expect(result.counts['studentsEnrolled']).toBe(1)
  expect(result.counts['annualProfilesSaved']).toBe(1)
  expect((await f.repositories.students.findById('already'))?.firstName).toBe('Old')
})
test('revoked initiating profile blocks background execution without creating records', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['001', 'New', 'Student']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const actor = f.service.baseService.actor
  if (actor.kind !== 'staff')
    throw new Error('test actor')
  const staff = (await f.repositories.staffMembers.findById(actor.staffMemberId))!
  await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
  await dispatchSchoolImports(f.application)
  expect(await f.repositories.students.count({ identifier: '001' })).toBe(0)
})
test('catalogues, classes, subjects, people, annual declarations, links, offerings, assignments, chapters, billing and payments form one durable batch', async () => {
  const f = await fixture()
  await f.service.academicsWorkflow.configureSubjectCategory({ id: 'category_id', schoolId: 'sch1', shortName: 'SCI', name: 'Science' } as Parameters<typeof f.service.academicsWorkflow.configureSubjectCategory>[0])
  await f.service.financeWorkflow.createCatalogService({ id: 'fee', academicYearId: 'ay1', name: 'Tuition', defaultPrice: 10000, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: 'active' as never })
  await f.submit('academic_disciplines', ['short_name', 'name'], [['SCI', 'Sciences']])
  await f.submit('placement_statuses', ['short_name', 'name'], [['AFF', 'Assigned']])
  await f.submit('classes', ['name', 'grade_id', 'capacity'], [['New class', 'grade1', 30]])
  await f.submit('subjects', ['name', 'grade_id', 'short_name', 'discipline_short_name', 'category_id', 'coefficient'], [['Science', 'grade1', 'SC1', 'SCI', 'category_id', 2]])
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_name', 'placement_status_short_name', 'is_repeating'], [['0001', 'Compound Name', 'Student', 'New class', 'AFF', false]])
  await f.submit('teachers', ['identifier', 'first_name', 'last_name', 'discipline_short_names', 'declared_hours'], [['T1', 'First', 'Teacher', 'SCI', 0]])
  await f.submit('guardians', ['identifier', 'first_name', 'last_name', 'phone', 'email', 'email_notifications_enabled'], [['G1', 'First', 'Guardian', '0001', 'g@example.test', false]])
  await f.submit('guardian_relationships', ['guardian_identifier', 'student_identifier', 'is_primary', 'legal_guardian'], [['G1', '0001', true, false]])
  await f.submit('class_offerings', ['class_name', 'subject_short_name', 'is_offered'], [['New class', 'SC1', true]])
  await f.submit('teacher_assignments', ['teacher_identifier', 'class_name', 'subject_short_name', 'responsibility'], [['T1', 'New class', 'SC1', 'Lead']])
  await f.submit('chapters', ['grade_id', 'subject_short_name', 'name', 'sequence'], [['grade1', 'SC1', 'First chapter', 1]])
  await f.submit('billing', ['student_identifier', 'catalog_service_id', 'amount', 'due_date'], [['0001', 'fee', 10000, '2025-10-01']])
  await f.submit('payments', ['student_identifier', 'catalog_service_id', 'reference', 'amount', 'payment_date', 'method'], [['0001', 'fee', 'receipt-001', 2000, '2025-10-01', 'cash']])
  const detail = await f.run()
  expect(detail.rows.filter(row => !['created', 'updated', 'unchanged'].includes(row.outcome)).map(row => ({ type: row.type, outcome: row.outcome, issues: row.issues }))).toEqual([])
  expect(detail.counts['studentsRegistered']).toBe(1)
  expect(detail.counts['studentsEnrolled']).toBe(1)
  expect(detail.counts['paymentsPosted']).toBe(1)
  expect(await f.repositories.payments.count({ reference: 'receipt-001' })).toBe(1)
  expect((await f.repositories.guardians.findOne({ identifier: 'G1' }))?.hasAccess).toBe(false)
  expect((await f.repositories.teacherAcademicYearProfiles.list({}))[0]?.declaredHours).toBe(0)
  expect(await f.repositories.accountInvitations.count({})).toBe(0)
  const repeated = await f.imports.create({ academicYearId: 'ay1', defaultOnExisting: 'O' })
  await f.imports.submit({ batchId: repeated.id, type: 'payments', fileName: 'payments.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['student_identifier', 'catalog_service_id', 'reference', 'amount', 'payment_date', 'method'], rows: [{ row: 2, cells: ['0001', 'fee', 'receipt-001', 2000, '2025-10-01', 'cash'] }] })) })
  const preview = await f.imports.validate({ batchId: repeated.id })
  await f.imports.confirm({ batchId: repeated.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(repeated.id)).rows[0]!.outcome).toBe('skipped')
  expect(await f.repositories.payments.count({ reference: 'receipt-001' })).toBe(1)
  const correction = await f.imports.create({ academicYearId: 'ay1' })
  await f.imports.submit({ batchId: correction.id, type: 'payments', fileName: 'payments.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['student_identifier', 'reference', 'amount', 'payment_date', 'method'], rows: [{ row: 2, cells: ['0001', 'receipt-001', 3000, '2025-10-01', 'cash'] }] })) })
  expect((await f.imports.validate({ batchId: correction.id })).rows[0]!.issues[0]!.code).toBe('IMPORT_FINANCIAL_REVERSAL_REQUIRED')
  // Every supported template exports stable targets and relationships, including paginated reads.
  const exported: { type: Parameters<typeof f.imports.export>[0]['type'], table: { headers: string[], rows: (string | number | boolean | null)[][] } }[] = []
  for (const type of ['academic_disciplines', 'placement_statuses', 'classes', 'subjects', 'students', 'guardians', 'teachers', 'staff', 'guardian_relationships', 'class_offerings', 'teacher_assignments', 'chapters', 'billing', 'payments'] as const) {
    let after: string | undefined
    do {
      const page = await f.imports.export({ type, academicYearId: 'ay1', format: 'csv', limit: 1, after })
      const table = JSON.parse(new TextDecoder().decode(page.bytes))
      if (table.rows.length)
        exported.push({ type, table })
      after = page.nextCursor ?? undefined
    } while (after)
  }
  for (const key of ['academicDisciplines', 'placementStatuses', 'classGroups', 'subjects', 'subjectMatters'] as const) {
    for (const entity of await f.repositories[key].list()) {
      await f.repositories[key].save(entity.copyWith({ name: `Renamed ${entity.id}`, shortName: 'Changed' }) as never)
    }
  }
  const roundtrip = await f.imports.create({ academicYearId: 'ay1' })
  for (const { type, table } of exported) {
    await f.imports.submit({ batchId: roundtrip.id, type, fileName: `${type}.csv`, bytes: new TextEncoder().encode(JSON.stringify({ headers: table.headers, rows: table.rows.map((cells, index) => ({ row: index + 2, cells })) })) })
  }
  const reviewed = await f.imports.validate({ batchId: roundtrip.id })
  expect(reviewed.rows.filter(row => row.outcome !== 'pending').map(row => ({ type: row.type, issues: row.issues }))).toEqual([])
  expect(reviewed.rows.every(row => row.targetId === row.values['target_id'])).toBe(true)
  await f.imports.confirm({ batchId: roundtrip.id, revision: reviewed.batch.revision, previewDigest: reviewed.batch.previewDigest! })
  await dispatchSchoolImports(f.application, { maxPages: 100 })
  const executed = await f.imports.detail(roundtrip.id)
  expect(executed.rows.filter(row => ['blocked', 'failed', 'dependency_blocked'].includes(row.outcome)).map(row => ({ type: row.type, issues: row.issues }))).toEqual([])
  expect(executed.rows.every(row => row.targetId === row.values['target_id'])).toBe(true)
})
test('corrected downloads preserve successful operation identities and missing columns', async () => {
  const f = await fixture()
  const file = await f.submit('staff', ['identifier', 'first_name', 'last_name', 'phone'], [['001', 'First', 'Last', '0012']])
  const first = await f.run()
  const report = JSON.parse(new TextDecoder().decode(await f.imports.report({ batchId: f.batch.id, fileId: file.fileId }))) as {
    headers: string[]
    rows: (string | number | boolean | null)[][]
  }
  expect(report.headers).not.toContain('email')
  await f.imports.submit({ batchId: f.batch.id, fileId: file.fileId, type: 'staff', fileName: 'correction.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: report.headers, rows: report.rows.map((cells, i) => ({ row: i + 2, cells })) })) })
  const next = await f.imports.validate({ batchId: f.batch.id })
  expect(next.rows[0]!.operationId).toBe(first.rows[0]!.operationId)
  expect(next.rows[0]!.outcome).toBe('created')
})
test('new duplicate business keys block every conflicting row and capacity never picks winners', async () => {
  const f = await fixture()
  await f.submit('staff', ['identifier', 'first_name', 'last_name'], [['DUP', 'First', 'One'], ['dup', 'First', 'Two']])
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id'], Array.from({ length: 45 }, (_, i) => [`S${i}`, 'First', 'Last', 'cg1']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows.filter(row => row.type === 'staff').every(row => row.issues.some(issue => issue.code === 'IMPORT_DUPLICATE_TARGET'))).toBe(true)
  expect(preview.rows.filter(row => row.type === 'students').every(row => row.issues.some(issue => issue.code === 'IMPORT_CLASS_CAPACITY_CONFLICT'))).toBe(true)
})
test('flat guardian overwrite clears explicit contacts and preserves omitted preferences', async () => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'flat', schoolId: 'sch1', identifier: 'FLAT', firstName: 'First', lastName: 'Guardian', phone: '+2250001', alternativePhone: '+2250002', email: 'g@example.test', smsNotificationsEnabled: false }))
  await f.submit('guardians', ['identifier', 'phone', 'on_existing'], [['FLAT', '', 'O']])
  const result = await f.run()
  expect(result.rows[0]!.outcome).toBe('updated')
  const saved = (await f.repositories.guardians.findById('flat'))!
  expect(saved.phone).toBeUndefined()
  expect(saved.alternativePhone).toBe('+2250002')
  expect(saved.email).toBe('g@example.test')
  expect(saved.smsNotificationsEnabled).toBe(false)
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).counts).toEqual(result.counts)
})

test('removed guardian contact collections block validation and corrected scalar files retain explicit opt-outs', async () => {
  const f = await fixture()
  const file = await f.submit('guardians', ['identifier', 'last_name', 'contact_methods'], [['FLAT', 'Parent', '[]']])
  const blocked = await f.imports.validate({ batchId: f.batch.id })
  expect(blocked.rows[0]!.issues).toContainEqual({ code: 'IMPORT_COLUMN_UNSUPPORTED', column: 'contact_methods', severity: 'error' })
  await f.imports.submit({ batchId: f.batch.id, fileId: file.fileId, type: 'guardians', fileName: 'guardians.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['identifier', 'last_name', 'phone', 'alternative_phone', 'email_notifications_enabled', 'sms_notifications_enabled', 'push_notifications_enabled'], rows: [{ row: 2, cells: ['FLAT', 'Parent', '+225 01020304', '+225 05060708', false, false, false] }] })) })
  const result = await f.run()
  expect(result.counts['created']).toBe(1)
  expect((await f.repositories.guardians.findOne({ identifier: 'FLAT' }))!.data).toMatchObject({ phone: '+22501020304', alternativePhone: '+22505060708', emailNotificationsEnabled: false, smsNotificationsEnabled: false, pushNotificationsEnabled: false })
})

test('duplicate confirmation and concurrent dispatch resume bounded pages without duplicate people', async () => {
  const f = await fixture()
  await f.submit('staff', ['identifier', 'first_name', 'last_name'], Array.from({ length: 24 }, (_, index) => [`R${index}`, 'First', 'Last']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  const approval = { batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! }
  await Promise.all([f.imports.confirm(approval), f.imports.confirm(approval)])
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).counts['created']).toBe(10)
  await Promise.all([dispatchSchoolImports(f.application), dispatchSchoolImports(f.application)])
  await dispatchSchoolImports(f.application)
  const complete = await f.imports.detail(f.batch.id)
  expect(complete.counts['created']).toBe(24)
  expect(complete.batch.state).toBe('completed')
  expect((await f.repositories.staffMembers.list({})).filter(person => person.identifier?.startsWith('R'))).toHaveLength(24)
})
test('cancellation preserves committed rows and prevents pending writes', async () => {
  const f = await fixture()
  await f.submit('staff', ['identifier', 'first_name', 'last_name'], Array.from({ length: 13 }, (_, index) => [`C${index}`, 'First', 'Last']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  await f.imports.cancel({ batchId: f.batch.id })
  await dispatchSchoolImports(f.application)
  const detail = await f.imports.detail(f.batch.id)
  expect(detail.counts['created']).toBe(10)
  expect(detail.counts['cancelled']).toBe(3)
})
test('a changed target after confirmation becomes a review conflict', async () => {
  const f = await fixture()
  const existing = new StaffMember({ id: 'editable', schoolId: 'sch1', identifier: 'EDIT', firstName: 'Old', lastName: 'Name', phone: '001' })
  await f.repositories.staffMembers.save(existing)
  await f.submit('staff', ['identifier', 'phone'], [['EDIT', '002']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await f.repositories.staffMembers.save(new StaffMember({ ...existing.data, phone: '003' }))
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).rows[0]!.issues[0]!.code).toBe('IMPORT_TARGET_CHANGED')
  expect((await f.repositories.staffMembers.findById('editable'))!.phone).toBe('003')
})

test('an enrollment workflow failure rolls back student registration and its import outcome together', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id'], [['ATOMIC', 'First', 'Last', 'cg1']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const forActor = f.application.forActor.bind(f.application)
  const spy = spyOn(f.application, 'forActor').mockImplementation((actor) => {
    const service = forActor(actor)
    service.studentWorkflow.enrollStudent = async () => {
      throw new BusinessRuleViolationError('TEST_PLACEMENT_CONFLICT', 'TEST_PLACEMENT_CONFLICT')
    }
    return service
  })
  try {
    await dispatchSchoolImports(f.application)
  }
  finally { spy.mockRestore() }
  expect(await f.repositories.students.count({ identifier: 'ATOMIC' })).toBe(0)
  const row = (await f.imports.detail(f.batch.id)).rows[0]!
  expect(row.outcome).toBe('blocked')
  expect(row.issues[0]!.code).toBe('TEST_PLACEMENT_CONFLICT')
})

test('a within-year import transfer preserves the annual profile and is not copied into another year', async () => {
  const f = await fixture()
  await f.repositories.classGroups.save(new ClassGroup(withShortName({ id: 'parallel', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'Parallel', capacity: 30 })))
  await f.service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: false })
  await f.submit('students', ['target_id', 'class_id', 'enrollment_effective_date'], [['stu1', 'parallel', '2025-10-01']])
  const complete = await f.run()
  expect(complete.rows[0]!.issues).toEqual([])
  expect(complete.counts['studentsTransferred']).toBe(1)
  expect((await f.repositories.enrollments.findById('enr1'))!.status).toBe(StudentClassEnrollmentStatus.Closed)
  expect((await f.repositories.enrollments.list({ studentId: 'stu1', status: 'active' as never }))[0]!.classGroupId).toBe('parallel')
  expect((await f.repositories.studentAcademicYearProfiles.list({ studentId: 'stu1', academicYearId: 'ay1' }))[0]!.isRepeating).toBe(false)
  expect(await f.repositories.studentAcademicYearProfiles.count({ studentId: 'stu1', academicYearId: 'ay2' })).toBe(0)
})

test('guardian shorthand previews retain per-child rights and detect a relationship change before committing', async () => {
  const f = await fixture()
  await f.repositories.students.save(new Student({ id: 'stu2', schoolId: 'sch1', firstName: 'Second', lastName: 'Child', identifier: 'CHILD2' }))
  await f.repositories.guardians.save(new Guardian({ id: 'guardian_identifier', schoolId: 'sch1', identifier: 'G', firstName: 'First', lastName: 'Guardian' }))
  const original = new GuardianStudentLink({ id: 'link1', schoolId: 'sch1', guardianId: 'guardian_identifier', studentId: 'stu1', legalGuardian: true })
  await f.repositories.guardianLinks.save(original)
  await f.repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link2', schoolId: 'sch1', guardianId: 'guardian_identifier', studentId: 'stu2', legalGuardian: false }))
  await f.submit('guardians', ['identifier', 'student_ids', 'notes'], [['G', 'stu1;stu2', 'Reviewed']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows[0]!.issues).toEqual([])
  expect(preview.rows[0]!.proposed!['studentRelationships']).toEqual(expect.arrayContaining([expect.objectContaining({ studentId: 'stu1', legalGuardian: true }), expect.objectContaining({ studentId: 'stu2', legalGuardian: false })]))
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await f.repositories.guardianLinks.save(new GuardianStudentLink({ ...original.data, legalGuardian: false }))
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).rows[0]!.issues[0]!.code).toBe('IMPORT_TARGET_CHANGED')
  expect((await f.repositories.guardianLinks.findById('link2'))!.notes).toBeUndefined()
})

test('omitted codes on explicit existing people and blank contact shorthand preserve unmentioned values', async () => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'known-guardian', schoolId: 'sch1', identifier: 'KEEP', firstName: 'First', lastName: 'Guardian', phone: '001', alternativePhone: '002' }))
  await f.submit('guardians', ['target_id', 'occupation', 'phone', 'on_existing'], [['known-guardian', 'Teacher', '', 'O']])
  const complete = await f.run()
  expect(complete.rows[0]!.outcome).toBe('updated')
  const guardian = (await f.repositories.guardians.findById('known-guardian'))!
  expect(guardian.identifier).toBe('KEEP')
  expect(guardian.phone).toBeUndefined()
  expect(guardian.alternativePhone).toBe('+2')
  expect(guardian.occupation).toBe('Teacher')
})

test('one bounded dispatcher invocation drains continuation pages independently of browser polling', async () => {
  const f = await fixture()
  await f.submit('staff', ['identifier', 'first_name', 'last_name'], Array.from({ length: 23 }, (_, index) => [`DRAIN${index}`, 'First', 'Last']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const dispatched = await dispatchSchoolImports(f.application, { maxPages: 4, maxDurationMs: 20000 })
  expect(dispatched.completed).toBe(3)
  const complete = await f.imports.detail(f.batch.id)
  expect(complete.batch.state).toBe('completed')
  expect(complete.counts['created']).toBe(23)
})

test('explicit unknown annual values persist separately from zero and false', async () => {
  const f = await fixture()
  await f.submit('teachers', ['identifier', 'first_name', 'last_name', 'declared_hours'], [['UNKNOWN', 'First', 'Teacher', ''], ['ZERO', 'Second', 'Teacher', 0]])
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'is_repeating'], [['UNKNOWN', 'First', 'Student', ''], ['FALSE', 'Second', 'Student', false]])
  const complete = await f.run()
  expect(complete.counts['annualProfilesSaved']).toBe(4)
  const unknownTeacher = (await f.repositories.teachers.findOne({ identifier: 'UNKNOWN' }))!
  const profile = (await f.repositories.teacherAcademicYearProfiles.findOne({ teacherId: unknownTeacher.id, academicYearId: 'ay1' }))!
  expect(profile.declaredHours).toBeUndefined()
  expect(profile.hoursPeriod).toBe('unspecified')
  expect((await f.repositories.studentAcademicYearProfiles.list({})).map(profile => profile.isRepeating)).toEqual(expect.arrayContaining([undefined, false]))
  const beforeTeachers = await f.repositories.teacherAcademicYearProfiles.list({})
  const beforeStudents = await f.repositories.studentAcademicYearProfiles.list({})
  const repeated = await f.imports.create({ academicYearId: 'ay1' })
  await f.imports.submit({ batchId: repeated.id, type: 'teachers', fileName: 'teachers.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['identifier', 'first_name', 'last_name', 'declared_hours'], rows: [{ row: 2, cells: ['UNKNOWN', 'First', 'Teacher', ''] }, { row: 3, cells: ['ZERO', 'Second', 'Teacher', 0] }] })) })
  await f.imports.submit({ batchId: repeated.id, type: 'students', fileName: 'students.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['identifier', 'first_name', 'last_name', 'is_repeating'], rows: [{ row: 2, cells: ['UNKNOWN', 'First', 'Student', ''] }, { row: 3, cells: ['FALSE', 'Second', 'Student', false] }] })) })
  const preview = await f.imports.validate({ batchId: repeated.id })
  for (const row of preview.rows)
    expect(row.proposed).toEqual(row.current)
  await f.imports.confirm({ batchId: repeated.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(repeated.id)).counts).toEqual({ unchanged: 4 })
  expect(await f.repositories.teacherAcademicYearProfiles.list({})).toEqual(beforeTeachers)
  expect(await f.repositories.studentAcademicYearProfiles.list({})).toEqual(beforeStudents)
})

test('conflicting class updates block dependent placements while unrelated ready people remain confirmable', async () => {
  const f = await fixture()
  await f.submit('classes', ['target_id', 'name'], [['cg1', 'One'], ['cg1', 'Two']])
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id'], [['DEPENDENT', 'First', 'Last', 'cg1']])
  await f.submit('staff', ['identifier', 'first_name', 'last_name'], [['READY', 'First', 'Last']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows.find(row => row.type === 'students')!.outcome).toBe('dependency_blocked')
  expect(preview.rows.find(row => row.type === 'staff')!.outcome).toBe('pending')
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect(await f.repositories.staffMembers.count({ identifier: 'READY' })).toBe(1)
  expect(await f.repositories.students.count({ identifier: 'DEPENDENT' })).toBe(0)
})

test('single-token guardians save/reload with normalized phones and resolve dependent contacts without duplication', async () => {
  const f = await fixture()
  await f.submit('guardians', ['identifier', 'first_name', 'last_name', 'source_full_name', 'phone'], [['SINGLE', '', 'Koné', ' Koné ', '#2250012345678']])
  const result = await f.run()
  const row = result.rows.find(row => row.type === 'guardians')!
  const saved = (await f.repositories.guardians.findById(row.targetId))!
  expect(saved.firstName).toBe('')
  expect(saved.fullName).toBe('Koné')
  expect(saved.sourceFullName).toBe(' Koné ')
  expect(saved.hasAccess).toBe(false)
  expect(saved.phone).toBe('+2250012345678')
  await f.imports.validate({ batchId: f.batch.id })
  expect(await f.repositories.guardians.count({ identifier: 'SINGLE' })).toBe(1)
})
test.each(['M', 'O', 'S'])('guardian %s handles blank first names without losing omitted fields', async (mode) => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'single', schoolId: 'sch1', identifier: 'SINGLE', firstName: 'Original', lastName: 'Koné', occupation: 'Teacher' }))
  await f.submit('guardians', ['identifier', 'first_name', 'on_existing'], [['SINGLE', '', mode]])
  await f.run()
  const saved = (await f.repositories.guardians.findById('single'))!
  expect(saved.firstName).toBe(mode === 'O' ? '' : 'Original')
  expect(saved.lastName).toBe('Koné')
  expect(saved.occupation).toBe('Teacher')
})

test('imported placements and annual profiles schedule automatic fees transactionally', async () => {
  const f = await fixture()
  const status = await f.service.academicsWorkflow.configurePlacementStatus({ id: 'billing-status', shortName: 'BILL', name: 'Billable' })
  await f.service.financeWorkflow.createCatalogService({ id: 'auto-fee', academicYearId: 'ay1', name: 'Automatic tuition', defaultPrice: 1000, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: CatalogServiceStatus.Active, autoBilling: { mode: 'matching', gradeLevelIds: ['grade1'], placementStatusIds: [status.id] } })
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(0)
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id', 'placement_status_short_name'], [['AUTO-001', 'Imported', 'Student', 'cg1', 'BILL']])
  await f.run()
  expect(await f.repositories.studentCharges.count()).toBe(0)
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(1)
  const student = await f.repositories.students.findOne({ identifier: 'AUTO-001' })
  expect((await f.repositories.studentCharges.list())[0]?.studentId).toBe(student?.id)
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(1)
})

test('execution uses bounded rows and status/history never load source snapshots', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id'], Array.from({ length: 24 }, (_, i) => [`bounded-${i}`, 'First', 'Last', 'cg1']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  let queries = 0
  const originalTransaction = f.db.transaction.bind(f.db)
  const transactions = spyOn(f.db, 'transaction').mockImplementation(run => originalTransaction(async (tx) => {
    const query = tx.query.bind(tx)
    tx.query = ((...args: Parameters<typeof query>) => {
      queries++
      return query(...args)
    }) as typeof tx.query
    return run(tx)
  }))
  const fullRead = spyOn(f.application.importPersistence, 'listRows').mockImplementation(async () => {
    throw new Error('Full row snapshots must not be loaded')
  })
  try {
    await dispatchSchoolImports(f.application, { maxPages: 100 })
    expect(queries).toBeLessThan(24 * 120 + 100)
    const status = await f.imports.status(f.batch.id)
    expect(status.batch.state).toBe('completed')
    expect(status.counts).toEqual({ created: 24, studentsRegistered: 24, studentsEnrolled: 24 })
    expect(status.version).toBeGreaterThan(0)
    expect(status.updatedAt).not.toBeNull()
    expect(JSON.stringify(status)).not.toContain('bounded-')
    expect((await f.imports.history()).map(batch => batch.id)).toContain(f.batch.id)
    expect(fullRead).not.toHaveBeenCalled()
  }
  finally {
    fullRead.mockRestore()
    transactions.mockRestore()
  }
}, 30000)

test('progress is transactional and unchanged row replays do not advance its version', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['metadata-1', 'First', 'Last']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  const before = await f.imports.status(f.batch.id)
  await f.atomicExecution.execute(() => f.application.importPersistence.saveRows(preview.rows))
  expect(await f.imports.status(f.batch.id)).toEqual(before)
  await expect(f.atomicExecution.execute(async () => {
    await f.application.importPersistence.saveRows(preview.rows.map(row => ({ ...row, outcome: 'created', result: { studentsRegistered: 1 } })))
    throw new Error('abort transaction')
  })).rejects.toThrow('abort transaction')
  expect(await f.imports.status(f.batch.id)).toEqual(before)
  const complete = await f.run()
  const after = await f.imports.status(f.batch.id)
  expect(after.counts).toEqual(complete.counts)
  await dispatchSchoolImports(f.application, { maxPages: 100 })
  expect(await f.imports.status(f.batch.id)).toEqual(after)
})

test('capacity changes after confirmation block every pending class member', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name', 'class_id'], [['capacity-a', 'A', 'Student', 'cg1'], ['capacity-b', 'B', 'Student', 'cg1']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const group = (await f.repositories.classGroups.findById('cg1'))!
  await f.repositories.classGroups.save(new ClassGroup(withShortName({ ...group.data, capacity: 1 })))
  await dispatchSchoolImports(f.application, { maxPages: 100 })
  const status = await f.imports.status(f.batch.id)
  expect(status.counts).toEqual({ blocked: 2 })
  expect(await f.repositories.students.count({ identifier: { $in: ['capacity-a', 'capacity-b'] } })).toBe(0)
})

test('exhausted jobs reconcile without a detail request and failed reads never mutate job state', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['exhausted', 'First', 'Last']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  const confirmed = await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await f.db.query('UPDATE command_outbox SET status = \'dead\' WHERE id = $1', [confirmed.workId])
  expect((await f.imports.status(f.batch.id)).batch.state).toBe('running')
  await dispatchSchoolImports(f.application)
  const result = await f.imports.status(f.batch.id)
  expect(result.batch.state).toBe('completed')
  expect(result.counts).toEqual({ failed: 1 })
  expect((await f.imports.detail(f.batch.id)).rows[0]!.issues[0]!.code).toBe('IMPORT_RETRY_EXHAUSTED')
})

test('identifier matching normalizes compatibility characters and preserves leading zeros', async () => {
  const f = await fixture()
  await f.repositories.students.save(new Student({ id: 'unicode-target', schoolId: 'sch1', identifier: '\u00A0ＭＡＴ-００１\u00A0', firstName: 'Old', lastName: 'Name' }))
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['mat-001', 'Updated', 'Name']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows[0]!.targetId).toBe('unicode-target')
  expect(preview.rows[0]!.outcome).toBe('pending')
  expect((await f.run()).counts).toEqual({ updated: 1 })
})

test('numeric zero progress counters survive updates and legacy backfill preserves approval and receipts', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['backfill-1', 'First', 'Last']])
  const complete = await f.run()
  const row = { ...complete.rows[0]!, result: { zero: 0 } }
  await f.atomicExecution.execute(() => f.application.importPersistence.saveRows([row]))
  const expected = await f.imports.status(f.batch.id)
  expect(expected.counts).toEqual({ created: 1, zero: 0 })
  const receipt = await f.atomicExecution.execute(() => f.application.importPersistence.findOutcome(f.batch.schoolId, f.batch.id, row.id, row.inputDigest))
  await f.db.query('UPDATE school_import_batches SET counts = \'{}\', progress_version = 0, progress_at = NULL WHERE id = $1', [f.batch.id])
  const migration = await Bun.file(new URL('../../../../adaptor-postgres/drizzle/0050_import_progress.sql', import.meta.url)).text()
  const backfill = migration.split('--> statement-breakpoint').at(-1)!
  await f.db.exec(backfill)
  const restored = await f.imports.status(f.batch.id)
  expect(restored.counts).toEqual(expected.counts)
  expect(restored.batch).toEqual(expected.batch)
  expect(await f.atomicExecution.execute(() => f.application.importPersistence.findOutcome(f.batch.schoolId, f.batch.id, row.id, row.inputDigest))).toEqual(receipt)
})

test('status, history and detail re-evaluate a revoked reader instead of trusting persisted progress', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], [['read-access', 'First', 'Last']])
  await f.run()
  expect((await f.imports.status(f.batch.id)).counts['created']).toBe(1)
  expect(await f.imports.history()).toHaveLength(1)
  const actor = f.service.baseService.actor
  if (actor.kind !== 'staff')
    throw new Error('test actor')
  const staff = (await f.repositories.staffMembers.findById(actor.staffMemberId))!
  await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
  await expect(f.imports.status(f.batch.id)).rejects.toThrow()
  await expect(f.imports.detail(f.batch.id)).rejects.toThrow()
  await expect(f.imports.history()).rejects.toThrow()
})

test('complete collections larger than the candidate page commit all outcomes in one progress transition', async () => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'large-guardian', schoolId: 'sch1', identifier: 'LARGE', firstName: 'First', lastName: 'Last' }))
  await f.imports.settings({ batchId: f.batch.id, defaultOnExisting: 'O' })
  for (let i = 0; i < 21; i++) {
    await f.repositories.students.save(new Student({ id: `child-${i}`, schoolId: 'sch1', identifier: `C${i}`, firstName: 'Child', lastName: String(i) }))
    await f.repositories.enrollments.save(new StudentClassEnrollment({ id: `placement-${i}`, studentId: `child-${i}`, classGroupId: 'cg1', academicYearId: 'ay1', enrollmentIndex: 1 }))
  }
  await f.submit('guardian_relationships', ['guardian_identifier', 'student_identifier', 'complete_collection'], Array.from({ length: 21 }, (_, i) => ['LARGE', `C${i}`, true]))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.counts['pending']).toBe(21)
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const before = await f.imports.status(f.batch.id)
  await dispatchSchoolImports(f.application)
  const after = await f.imports.status(f.batch.id)
  expect(after.batch.state).toBe('completed')
  expect(after.version).toBe(before.version + 1)
  expect((await f.imports.detail(f.batch.id)).rows.map(row => ({ outcome: row.outcome, issues: row.issues }))).toEqual(Array.from({ length: 21 }, () => ({ outcome: 'created', issues: [] })))
  expect(after.counts['created']).toBe(21)
  expect(await f.repositories.guardianLinks.count({ guardianId: 'large-guardian' })).toBe(21)
  expect((await f.imports.detail(f.batch.id)).counts).toEqual(after.counts)
}, 30000)

test('a restarted dispatcher recovers an expired lease after a lost completion response without duplicate counters', async () => {
  const f = await fixture()
  await f.submit('students', ['identifier', 'first_name', 'last_name'], Array.from({ length: 23 }, (_, i) => [`restart-${i}`, 'First', 'Last']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const completion = spyOn(f.durableWork, 'complete').mockResolvedValueOnce(false)
  try {
    expect((await dispatchSchoolImports(f.application)).lostLease).toBe(1)
  }
  finally { completion.mockRestore() }
  expect((await f.imports.status(f.batch.id)).counts['created']).toBe(10)
  await f.db.query('UPDATE command_outbox SET lease_expires_at = clock_timestamp() - INTERVAL \'1 second\' WHERE status = \'running\'')
  const restarted = new SchoolApplication({ repositories: f.repositories, atomicExecution: f.atomicExecution, commandJournal: new PostgresCommandJournal(), durableWork: f.durableWork, importPersistence: new PostgresImportStore(), importFormat: format, fileStorage: createInMemoryFileStorage(), notificationGateway: noOpNotificationGateway })
  await dispatchSchoolImports(restarted, { maxPages: 100 })
  const final = await restarted.forActor(f.service.baseService.actor).imports.status(f.batch.id)
  expect(final.batch.state).toBe('completed')
  expect(final.counts).toEqual({ created: 23, studentsRegistered: 23 })
  expect(await f.repositories.students.count({ identifier: { $in: Array.from({ length: 23 }, (_, i) => `RESTART-${i}`) } })).toBe(23)
  await dispatchSchoolImports(restarted, { maxPages: 100 })
  expect(await f.imports.status(f.batch.id)).toEqual(final)
}, 30000)

test('relationship preview shares permission reads and uses exact resolved guardian IDs', async () => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'Parent-ID', schoolId: 'sch1', identifier: 'G1', firstName: 'First', lastName: 'Parent' }))
  for (let i = 0; i < 24; i++)
    await f.repositories.students.save(new Student({ id: `child-${i}`, schoolId: 'sch1', identifier: `C${i}`, firstName: 'Child', lastName: String(i) }))
  await f.submit('guardian_relationships', ['guardian_identifier', 'student_identifier'], Array.from({ length: 24 }, (_, i) => [' ｇ１ ', `C${i}`]))
  let permissionReads = 0
  let normalizedOwnerReads = 0
  const originalTransaction = f.db.transaction.bind(f.db)
  const transactions = spyOn(f.db, 'transaction').mockImplementation(run => originalTransaction(async (tx) => {
    const query = tx.query.bind(tx)
    tx.query = ((...args: Parameters<typeof query>) => {
      const sql = String(args[0])
      if (/from "(?:schools|staff_members)"/.test(sql))
        permissionReads++
      if (sql.includes('translate(btrim("guardians"."id"') && !sql.includes('translate(btrim("guardians"."code"'))
        normalizedOwnerReads++
      return query(...args)
    }) as typeof tx.query
    return run(tx)
  }))
  try {
    const preview = await f.imports.validate({ batchId: f.batch.id })
    expect(preview.counts['pending']).toBe(24)
    expect(preview.rows.every(row => row.proposed?.['guardianId'] === 'Parent-ID')).toBe(true)
    expect(permissionReads).toBeLessThan(40)
    expect(normalizedOwnerReads).toBe(0)
  }
  finally { transactions.mockRestore() }
  const staff = (await f.repositories.staffMembers.findById('user1'))!
  await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
  await expect(f.imports.validate({ batchId: f.batch.id })).rejects.toThrow()
  expect(await f.repositories.guardianLinks.count({ guardianId: 'Parent-ID' })).toBe(0)
})

test('resolved relationship IDs remain case-sensitive and identifiers cannot be silently reassigned', async () => {
  const f = await fixture()
  for (const [id, identifier] of [['Parent-ID', 'G1'], ['parent-id', 'G2']] as const) {
    await f.repositories.guardians.save(new Guardian({ id, identifier, schoolId: 'sch1', firstName: 'First', lastName: 'Parent' }))
    await f.repositories.guardianLinks.save(new GuardianStudentLink({ id: `link-${id}`, schoolId: 'sch1', guardianId: id, studentId: 'stu1', relationship: 'parent' }))
  }
  await f.submit('guardian_relationships', ['guardian_identifier', 'student_id', 'legal_guardian'], [['G1', 'stu1', true]])
  const result = await f.run()
  expect(result.rows.map(row => [row.targetId, row.outcome])).toEqual([['link-Parent-ID', 'updated']])
  expect((await f.repositories.guardianLinks.findById('link-Parent-ID'))!.legalGuardian).toBe(true)
  expect((await f.repositories.guardianLinks.findById('link-parent-id'))!.legalGuardian).toBe(false)
  const other = (await f.repositories.guardians.findById('parent-id'))!
  await expect(f.repositories.guardians.save(new Guardian({ ...other.data, identifier: 'G1' }))).rejects.toThrow()
  expect((await f.repositories.guardians.findById('parent-id'))!.identifier).toBe('G2')
})

test('execution context sees entity changes and permission revocation between collection writes', async () => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'parent', schoolId: 'sch1', firstName: 'Before', lastName: 'Parent' }))
  await f.atomicExecution.execute(async () => {
    const ctx = new ImportBusinessContext(f.service, f.batch)
    const before = await ctx.readable('guardians', 'parent')
    await f.repositories.guardians.save(new Guardian({ ...before.data, firstName: 'After' }))
    expect((await ctx.readable('guardians', 'parent')).firstName).toBe('After')
    const staff = (await f.repositories.staffMembers.findById('user1'))!
    await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
    await expect(ctx.readable('guardians', 'parent')).rejects.toThrow()
  })
})
