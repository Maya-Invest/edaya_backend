/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { ImportFormatPort, ParsedImportTable } from '@edaya/core'
import { BusinessRuleViolationError, CatalogServiceStatus, ClassGroup, createInMemoryFileStorage, Guardian, GuardianContactMethodType, GuardianStudentLink, noOpNotificationGateway, StaffMember, Student, StudentClassEnrollmentStatus } from '@edaya/core'
import { dispatchAutoBilling, dispatchSchoolImports, SchoolApplication } from '@edaya/service'
import { expect, spyOn, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresImportStore } from '../../../../adaptor-postgres/src/stores/import-store'
import { createStudentTransitionContext } from '../../services/workflows/student-workflow-context'
// Application tests drive the parsing port, not a spreadsheet implementation.
const format: ImportFormatPort = { parse: async ({ bytes }) => JSON.parse(new TextDecoder().decode(bytes)) as ParsedImportTable, serialize: async data => new TextEncoder().encode(JSON.stringify(data)) }
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
  await f.submit('staff', ['code', 'first_name', 'last_name', 'phone'], [['001', 'Compound First', 'Compound Last', '+225 0001']])
  const complete = await f.run()
  expect(complete.rows.map(row => [row.outcome, row.issues])).toEqual([['created', []]])
  expect((await f.repositories.staffMembers.findById(complete.rows[0]!.targetId))?.phone).toBe('+225 0001')
  const again = await f.imports.validate({ batchId: f.batch.id })
  expect(again.counts['created']).toBe(1)
  expect(await f.repositories.staffMembers.count({ code: '001' })).toBe(1)
})
test('invalid mode blocks a row and changing session settings invalidates confirmation', async () => {
  const f = await fixture()
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'on_existing'], [['001', 'New', 'Student', 'bad'], ['002', 'Other', 'Student', ' m ']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.counts['blocked']).toBe(1)
  expect(preview.rows.find(row => row.outcome === 'blocked')?.issues[0]?.code).toBe('IMPORT_ON_EXISTING_INVALID')
  await f.imports.settings({ batchId: f.batch.id, defaultOnExisting: 'S' })
  await expect(f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })).rejects.toMatchObject({ code: 'IMPORT_PREVIEW_STALE' })
})
test('skipped people resolve dependent identity and class placement commits atomically', async () => {
  const f = await fixture()
  await f.repositories.students.save(new Student({ id: 'already', schoolId: 'sch1', firstName: 'Old', lastName: 'Student', matricule: '001' }))
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class', 'is_repeating', 'on_existing'], [['001', 'Ignored', 'Name', null, false, 'S'], ['002', 'New', 'Student', 'cg1', false, 'M']])
  const result = await f.run()
  expect(result.rows.map(row => ({ outcome: row.outcome, issues: row.issues }))).toEqual(expect.arrayContaining([{ outcome: 'skipped', issues: [] }]))
  expect(result.counts['skipped']).toBe(1)
  expect(result.counts['studentsEnrolled']).toBe(1)
  expect(result.counts['annualProfilesSaved']).toBe(1)
  expect((await f.repositories.students.findById('already'))?.firstName).toBe('Old')
})
test('revoked initiating profile blocks background execution without creating records', async () => {
  const f = await fixture()
  await f.submit('students', ['matricule', 'first_name', 'last_name'], [['001', 'New', 'Student']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  const actor = f.service.baseService.actor
  if (actor.kind !== 'staff')
    throw new Error('test actor')
  const staff = (await f.repositories.staffMembers.findById(actor.staffMemberId))!
  await f.repositories.staffMembers.save(new StaffMember({ ...staff.data, isActive: false }))
  await dispatchSchoolImports(f.application)
  expect(await f.repositories.students.count({ matricule: '001' })).toBe(0)
})
test('catalogues, classes, subjects, people, annual declarations, links, offerings, assignments, chapters, billing and payments form one durable batch', async () => {
  const f = await fixture()
  await f.service.academicsWorkflow.configureSubjectCategory({ id: 'category', schoolId: 'sch1', code: 'SCI', name: 'Science' } as Parameters<typeof f.service.academicsWorkflow.configureSubjectCategory>[0])
  await f.service.financeWorkflow.createCatalogService({ id: 'fee', academicYearId: 'ay1', name: 'Tuition', defaultPrice: 10000, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: 'active' as never })
  await f.submit('academic_disciplines', ['code', 'name'], [['SCI', 'Sciences']])
  await f.submit('placement_statuses', ['code', 'label'], [['AFF', 'Assigned']])
  await f.submit('classes', ['name', 'grade', 'capacity'], [['New class', 'grade1', 30]])
  await f.submit('subjects', ['name', 'grade', 'code', 'discipline_code', 'category', 'coefficient'], [['Science', 'grade1', 'SC1', 'SCI', 'category', 2]])
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class', 'placement_status_code', 'is_repeating'], [['0001', 'Compound Name', 'Student', 'New class', 'AFF', false]])
  await f.submit('teachers', ['code', 'first_name', 'last_name', 'discipline_codes', 'declared_hours'], [['T1', 'First', 'Teacher', 'SCI', 0]])
  await f.submit('guardians', ['code', 'first_name', 'last_name', 'phone'], [['G1', 'First', 'Guardian', '0001']])
  await f.submit('guardian_contacts', ['guardian', 'type', 'value', 'allows_notifications'], [['G1', 'email', 'g@example.test', false]])
  await f.submit('guardian_relationships', ['guardian', 'student', 'is_primary', 'legal_guardian'], [['G1', '0001', true, false]])
  await f.submit('class_offerings', ['class', 'subject', 'is_offered'], [['New class', 'SC1', true]])
  await f.submit('teacher_assignments', ['teacher', 'class', 'subject', 'responsibility'], [['T1', 'New class', 'SC1', 'Lead']])
  await f.submit('chapters', ['grade', 'subject', 'title', 'sequence'], [['grade1', 'SC1', 'First chapter', 1]])
  await f.submit('billing', ['student', 'catalog_service', 'amount', 'due_date'], [['0001', 'fee', 10000, '2025-10-01']])
  await f.submit('payments', ['student', 'catalog_service', 'reference', 'amount', 'payment_date', 'method'], [['0001', 'fee', 'receipt-001', 2000, '2025-10-01', 'cash']])
  const detail = await f.run()
  expect(detail.rows.filter(row => !['created', 'updated', 'unchanged'].includes(row.outcome)).map(row => ({ type: row.type, outcome: row.outcome, issues: row.issues }))).toEqual([])
  expect(detail.counts['studentsRegistered']).toBe(1)
  expect(detail.counts['studentsEnrolled']).toBe(1)
  expect(detail.counts['paymentsPosted']).toBe(1)
  expect(await f.repositories.payments.count({ reference: 'receipt-001' })).toBe(1)
  expect((await f.repositories.guardians.findOne({ code: 'G1' }))?.hasAccess).toBe(false)
  expect((await f.repositories.teacherAcademicYearProfiles.list({}))[0]?.declaredHours).toBe(0)
  expect(await f.repositories.accountInvitations.count({})).toBe(0)
  const repeated = await f.imports.create({ academicYearId: 'ay1', defaultOnExisting: 'O' })
  await f.imports.submit({ batchId: repeated.id, type: 'payments', fileName: 'payments.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['student', 'catalog_service', 'reference', 'amount', 'payment_date', 'method'], rows: [{ row: 2, cells: ['0001', 'fee', 'receipt-001', 2000, '2025-10-01', 'cash'] }] })) })
  const preview = await f.imports.validate({ batchId: repeated.id })
  await f.imports.confirm({ batchId: repeated.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(repeated.id)).rows[0]!.outcome).toBe('skipped')
  expect(await f.repositories.payments.count({ reference: 'receipt-001' })).toBe(1)
  const correction = await f.imports.create({ academicYearId: 'ay1' })
  await f.imports.submit({ batchId: correction.id, type: 'payments', fileName: 'payments.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['student', 'reference', 'amount', 'payment_date', 'method'], rows: [{ row: 2, cells: ['0001', 'receipt-001', 3000, '2025-10-01', 'cash'] }] })) })
  expect((await f.imports.validate({ batchId: correction.id })).rows[0]!.issues[0]!.code).toBe('IMPORT_FINANCIAL_REVERSAL_REQUIRED')
})
test('corrected downloads preserve successful operation identities and missing columns', async () => {
  const f = await fixture()
  const file = await f.submit('staff', ['code', 'first_name', 'last_name', 'phone'], [['001', 'First', 'Last', '0012']])
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
  await f.submit('staff', ['code', 'first_name', 'last_name'], [['DUP', 'First', 'One'], ['dup', 'First', 'Two']])
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class'], Array.from({ length: 45 }, (_, i) => [`S${i}`, 'First', 'Last', 'cg1']))
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows.filter(row => row.type === 'staff').every(row => row.issues.some(issue => issue.code === 'IMPORT_DUPLICATE_TARGET'))).toBe(true)
  expect(preview.rows.filter(row => row.type === 'students').every(row => row.issues.some(issue => issue.code === 'IMPORT_CLASS_CAPACITY_CONFLICT'))).toBe(true)
})
test('overwrite of a partial child file preserves other contacts; complete declaration replaces them atomically', async () => {
  const f = await fixture()
  await f.submit('guardians', ['code', 'first_name', 'last_name', 'phone'], [['G1', 'First', 'Guardian', '0001']])
  await f.run()
  const batch = await f.imports.create({ academicYearId: 'ay1', defaultOnExisting: 'O' })
  const upload = async (complete: boolean) => f.imports.submit({ batchId: batch.id, type: 'guardian_contacts', fileName: `contacts-${complete}.csv`, bytes: new TextEncoder().encode(JSON.stringify({ headers: ['guardian', 'type', 'value', 'complete_collection'], rows: [{ row: 2, cells: ['G1', 'email', 'g@example.test', complete] }] })) })
  const execute = async () => {
    const preview = await f.imports.validate({ batchId: batch.id,
    })
    await f.imports.confirm({ batchId: batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest!,
    })
    await dispatchSchoolImports(f.application)
  }
  const file = await upload(false)
  await execute()
  expect((await f.repositories.guardians.findOne({ code: 'G1' }))!.contactMethods).toHaveLength(2)
  const detail = await f.imports.detail(batch.id)
  await f.imports.submit({ batchId: batch.id, fileId: file.fileId, type: 'guardian_contacts', fileName: 'contacts-corrected.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['row_id', 'guardian', 'type', 'value', 'complete_collection'], rows: [{ row: 2, cells: [detail.rows[0]!.id, 'G1', 'email', 'g@example.test', true] }] })) })
  await execute()
  expect((await f.imports.detail(batch.id)).rows.map(row => [row.outcome, row.issues])).toEqual([['updated', []]])
  expect((await f.repositories.guardians.findOne({ code: 'G1' }))!.contactMethods).toHaveLength(1)
})

test('duplicate confirmation and concurrent dispatch resume bounded pages without duplicate people', async () => {
  const f = await fixture()
  await f.submit('staff', ['code', 'first_name', 'last_name'], Array.from({ length: 24 }, (_, index) => [`R${index}`, 'First', 'Last']))
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
  expect((await f.repositories.staffMembers.list({})).filter(person => person.code?.startsWith('R'))).toHaveLength(24)
})
test('cancellation preserves committed rows and prevents pending writes', async () => {
  const f = await fixture()
  await f.submit('staff', ['code', 'first_name', 'last_name'], Array.from({ length: 13 }, (_, index) => [`C${index}`, 'First', 'Last']))
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
  const existing = new StaffMember({ id: 'editable', schoolId: 'sch1', code: 'EDIT', firstName: 'Old', lastName: 'Name', phone: '001' })
  await f.repositories.staffMembers.save(existing)
  await f.submit('staff', ['code', 'phone'], [['EDIT', '002']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await f.repositories.staffMembers.save(new StaffMember({ ...existing.data, phone: '003' }))
  await dispatchSchoolImports(f.application)
  expect((await f.imports.detail(f.batch.id)).rows[0]!.issues[0]!.code).toBe('IMPORT_TARGET_CHANGED')
  expect((await f.repositories.staffMembers.findById('editable'))!.phone).toBe('003')
})

test('an enrollment workflow failure rolls back student registration and its import outcome together', async () => {
  const f = await fixture()
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class'], [['ATOMIC', 'First', 'Last', 'cg1']])
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
  expect(await f.repositories.students.count({ matricule: 'ATOMIC' })).toBe(0)
  const row = (await f.imports.detail(f.batch.id)).rows[0]!
  expect(row.outcome).toBe('blocked')
  expect(row.issues[0]!.code).toBe('TEST_PLACEMENT_CONFLICT')
})

test('a within-year import transfer preserves the annual profile and is not copied into another year', async () => {
  const f = await fixture()
  await f.repositories.classGroups.save(new ClassGroup({ id: 'parallel', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'Parallel', capacity: 30 }))
  await f.service.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'stu1', academicYearId: 'ay1', isRepeating: false })
  await f.submit('students', ['target_id', 'class', 'enrollment_effective_date'], [['stu1', 'parallel', '2025-10-01']])
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
  await f.repositories.students.save(new Student({ id: 'stu2', schoolId: 'sch1', firstName: 'Second', lastName: 'Child', matricule: 'CHILD2' }))
  await f.repositories.guardians.save(new Guardian({ id: 'guardian', schoolId: 'sch1', code: 'G', firstName: 'First', lastName: 'Guardian', contactMethods: [] }))
  const original = new GuardianStudentLink({ id: 'link1', schoolId: 'sch1', guardianId: 'guardian', studentId: 'stu1', legalGuardian: true })
  await f.repositories.guardianLinks.save(original)
  await f.repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link2', schoolId: 'sch1', guardianId: 'guardian', studentId: 'stu2', legalGuardian: false }))
  await f.submit('guardians', ['code', 'students', 'notes'], [['G', 'stu1;CHILD2', 'Reviewed']])
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
  await f.repositories.guardians.save(new Guardian({ id: 'known-guardian', schoolId: 'sch1', code: 'KEEP', firstName: 'First', lastName: 'Guardian', contactMethods: [{ type: GuardianContactMethodType.Phone, value: '001', isPrimary: true }, { type: GuardianContactMethodType.Phone, value: '002', isPrimary: false }] }))
  await f.submit('guardians', ['target_id', 'occupation', 'phone', 'on_existing'], [['known-guardian', 'Teacher', '', 'O']])
  const complete = await f.run()
  expect(complete.rows[0]!.outcome).toBe('updated')
  const guardian = (await f.repositories.guardians.findById('known-guardian'))!
  expect(guardian.code).toBe('KEEP')
  expect(guardian.contactMethods.map(contact => contact.value)).toEqual(['001', '002'])
  expect(guardian.occupation).toBe('Teacher')
})

test('one bounded dispatcher invocation drains continuation pages independently of browser polling', async () => {
  const f = await fixture()
  await f.submit('staff', ['code', 'first_name', 'last_name'], Array.from({ length: 23 }, (_, index) => [`DRAIN${index}`, 'First', 'Last']))
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
  await f.submit('teachers', ['code', 'first_name', 'last_name', 'declared_hours'], [['UNKNOWN', 'First', 'Teacher', ''], ['ZERO', 'Second', 'Teacher', 0]])
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'is_repeating'], [['UNKNOWN', 'First', 'Student', ''], ['FALSE', 'Second', 'Student', false]])
  const complete = await f.run()
  expect(complete.counts['annualProfilesSaved']).toBe(4)
  const unknownTeacher = (await f.repositories.teachers.findOne({ code: 'UNKNOWN' }))!
  const profile = (await f.repositories.teacherAcademicYearProfiles.findOne({ teacherId: unknownTeacher.id, academicYearId: 'ay1' }))!
  expect(profile.declaredHours).toBeUndefined()
  expect(profile.hoursPeriod).toBe('unspecified')
  expect((await f.repositories.studentAcademicYearProfiles.list({})).map(profile => profile.isRepeating)).toEqual(expect.arrayContaining([undefined, false]))
  const beforeTeachers = await f.repositories.teacherAcademicYearProfiles.list({})
  const beforeStudents = await f.repositories.studentAcademicYearProfiles.list({})
  const repeated = await f.imports.create({ academicYearId: 'ay1' })
  await f.imports.submit({ batchId: repeated.id, type: 'teachers', fileName: 'teachers.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['code', 'first_name', 'last_name', 'declared_hours'], rows: [{ row: 2, cells: ['UNKNOWN', 'First', 'Teacher', ''] }, { row: 3, cells: ['ZERO', 'Second', 'Teacher', 0] }] })) })
  await f.imports.submit({ batchId: repeated.id, type: 'students', fileName: 'students.csv', bytes: new TextEncoder().encode(JSON.stringify({ headers: ['matricule', 'first_name', 'last_name', 'is_repeating'], rows: [{ row: 2, cells: ['UNKNOWN', 'First', 'Student', ''] }, { row: 3, cells: ['FALSE', 'Second', 'Student', false] }] })) })
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
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class'], [['DEPENDENT', 'First', 'Last', 'cg1']])
  await f.submit('staff', ['code', 'first_name', 'last_name'], [['READY', 'First', 'Last']])
  const preview = await f.imports.validate({ batchId: f.batch.id })
  expect(preview.rows.find(row => row.type === 'students')!.outcome).toBe('dependency_blocked')
  expect(preview.rows.find(row => row.type === 'staff')!.outcome).toBe('pending')
  await f.imports.confirm({ batchId: f.batch.id, revision: preview.batch.revision, previewDigest: preview.batch.previewDigest! })
  await dispatchSchoolImports(f.application)
  expect(await f.repositories.staffMembers.count({ code: 'READY' })).toBe(1)
  expect(await f.repositories.students.count({ matricule: 'DEPENDENT' })).toBe(0)
})

test('single-token guardians save/reload with normalized phones and resolve dependent contacts without duplication', async () => {
  const f = await fixture()
  await f.submit('guardians', ['code', 'first_name', 'last_name', 'source_full_name', 'phone'], [['SINGLE', '', 'Koné', ' Koné ', '#2250012345678']])
  await f.submit('guardian_contacts', ['guardian', 'type', 'value', 'is_primary'], [['SINGLE', 'phone', '+2250012345678', true]])
  const result = await f.run()
  const row = result.rows.find(row => row.type === 'guardians')!
  const saved = (await f.repositories.guardians.findById(row.targetId))!
  expect(saved.firstName).toBe('')
  expect(saved.fullName).toBe('Koné')
  expect(saved.sourceFullName).toBe(' Koné ')
  expect(saved.hasAccess).toBe(false)
  expect(saved.contactMethods.map(contact => contact.value)).toEqual(['+2250012345678'])
  await f.imports.validate({ batchId: f.batch.id })
  expect(await f.repositories.guardians.count({ code: 'SINGLE' })).toBe(1)
})
test.each(['M', 'O', 'S'])('guardian %s handles blank first names without losing omitted fields', async (mode) => {
  const f = await fixture()
  await f.repositories.guardians.save(new Guardian({ id: 'single', schoolId: 'sch1', code: 'SINGLE', firstName: 'Original', lastName: 'Koné', occupation: 'Teacher' }))
  await f.submit('guardians', ['code', 'first_name', 'on_existing'], [['SINGLE', '', mode]])
  await f.run()
  const saved = (await f.repositories.guardians.findById('single'))!
  expect(saved.firstName).toBe(mode === 'O' ? '' : 'Original')
  expect(saved.lastName).toBe('Koné')
  expect(saved.occupation).toBe('Teacher')
})

test('imported placements and annual profiles schedule automatic fees transactionally', async () => {
  const f = await fixture()
  const status = await f.service.academicsWorkflow.configurePlacementStatus({ id: 'billing-status', code: 'BILL', label: 'Billable' })
  await f.service.financeWorkflow.createCatalogService({ id: 'auto-fee', academicYearId: 'ay1', name: 'Automatic tuition', defaultPrice: 1000, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: CatalogServiceStatus.Active, autoBilling: { mode: 'matching', gradeLevelIds: ['grade1'], placementStatusIds: [status.id] } })
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(0)
  await f.submit('students', ['matricule', 'first_name', 'last_name', 'class', 'placement_status_code'], [['AUTO-001', 'Imported', 'Student', 'cg1', 'BILL']])
  await f.run()
  expect(await f.repositories.studentCharges.count()).toBe(0)
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(1)
  const student = await f.repositories.students.findOne({ matricule: 'AUTO-001' })
  expect((await f.repositories.studentCharges.list())[0]?.studentId).toBe(student?.id)
  await dispatchAutoBilling(f.application)
  expect(await f.repositories.studentCharges.count()).toBe(1)
})
