import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, createInMemoryFileStorage, DOCUMENT_FAILURES, DocumentIssuanceStatus, EnrollmentEndReason, GradeLevel, Guardian, GuardianStudentLink, noOpNotificationGateway, School, StaffMember, Student, StudentClassEnrollment, Teacher, withShortName } from '@edaya/core'
import { dispatchDocumentRender, grantAttachmentDownload, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { createFixtureRepositories } from '../utils/fixture-repositories'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')

const handles = await Promise.all([
  createPostgresSchoolDatabase(url, { max: 1 }),
  createPostgresSchoolDatabase(url, { max: 1 }),
])
const stores = handles.map(handle => createFixtureRepositories(handle.db))
const repositories = stores[0]!
interface Executor { execute: (query: SQL) => Promise<unknown> }
const actor = createStaffActorMetadata({
  schoolId: 'docs-school',
  staffMemberId: 'docs-staff',
  subjectId: 'docs-owner',
  academicYearId: 'docs-year',
  requestId: 'native-docs',
  authenticatedAt: new Date(),
  assuranceLevel: ActorAssuranceLevel.Verified,
})
const school = new School(withShortName({ id: actor.schoolId, name: 'Documents fixture', timeZone: 'UTC', ownerSubjectId: actor.subjectId }))
const pdf = new TextEncoder().encode('%PDF-1.4 native-official')
const storage = createInMemoryFileStorage()

function application(index: number) {
  const handle = handles[index]!
  return new SchoolApplication({ repositories: stores[index]!, atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handle.db as Executor), documentRenderer: {
    async render() {
      return { bytes: pdf, contentType: 'application/pdf', sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', renderId: 'native-docs' }
    },
  }, notificationGateway: noOpNotificationGateway, fileStorage: storage })
}

beforeAll(async () => {
  await repositories.init({ driver: 'node-postgres' })
  await repositories.schools.save(school)
  await repositories.staffMembers.save(new StaffMember({ id: actor.staffMemberId, schoolId: school.id, firstName: 'Docs', lastName: 'Owner', subjectId: actor.subjectId }))
  await repositories.academicYears.save(new AcademicYear(withShortName({
    id: 'docs-year',
    schoolId: school.id,
    name: '2026',
    status: 'published',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'docs-grade', schoolId: school.id, name: 'Grade', shortName: 'G', order: 1 })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'docs-class', schoolId: school.id, academicYearId: 'docs-year', gradeLevelId: 'docs-grade', name: 'Class' })))
  await repositories.students.save(new Student({ id: 'docs-student', schoolId: school.id, firstName: 'Ada', lastName: 'Lovelace' }))
  await repositories.enrollments.save(new StudentClassEnrollment({
    id: 'docs-enrollment',
    studentId: 'docs-student',
    classGroupId: 'docs-class',
    academicYearId: 'docs-year',
    enrollmentIndex: 1,
    enrolledAt: new Date('2026-01-15'),
  }))
  await repositories.students.save(new Student({ id: 'docs-student-b', schoolId: school.id, firstName: 'Alan', lastName: 'Turing' }))
  await repositories.enrollments.save(new StudentClassEnrollment({
    id: 'docs-enrollment-b',
    studentId: 'docs-student-b',
    classGroupId: 'docs-class',
    academicYearId: 'docs-year',
    enrollmentIndex: 1,
    enrolledAt: new Date('2026-01-16'),
  }))
}, 30000)

afterAll(() => Promise.all(handles.map(handle => handle.dispose())))

test('concurrent numbered issuances reserve distinct series values', async () => {
  const [left, right] = [application(0).forActor(actor), application(1).forActor(actor)]
  const [first, second] = await Promise.all([
    left.documentsWorkflow.requestDocumentIssuance({
      requestId: 'native-cert-a',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'docs-enrollment',
    }),
    right.documentsWorkflow.requestDocumentIssuance({
      requestId: 'native-cert-b',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'docs-enrollment-b',
    }),
  ])
  expect(new Set([first.number, second.number]).size).toBe(2)
  expect(first.number).toMatch(/^SCHOOLIN-2026-\d{6}$/)
  expect(second.number).toMatch(/^SCHOOLIN-2026-\d{6}$/)
}, 30000)

test('duplicate request identity is idempotent and corrections take a new number', async () => {
  const app = application(0)
  const service = app.forActor(actor)
  const first = await service.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-dup',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  const again = await service.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-dup',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  expect(again.id).toBe(first.id)
  expect(again.number).toBe(first.number)
  await dispatchDocumentRender(app)

  const corrected = await service.documentsWorkflow.correctDocumentIssuance({
    requestId: 'native-correct',
    issuanceId: first.id,
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  expect(corrected.id).not.toBe(first.id)
  expect(corrected.number).not.toBe(first.number)
  expect((await repositories.documentIssuances.findById(first.id))?.status).toBe(DocumentIssuanceStatus.Superseded)
}, 30000)

test('family cannot download guessed or non-ready issuances; ready current certificates are granted', async () => {
  const app = application(0)
  const staff = app.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-family',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  await repositories.guardians.save(new Guardian({
    id: 'docs-guardian',
    schoolId: school.id,
    firstName: 'Grace',
    lastName: 'Hopper',
    subjectId: 'docs-guardian-person',
  }))
  await repositories.guardianLinks.save(new GuardianStudentLink({
    id: 'docs-link',
    schoolId: school.id,
    guardianId: 'docs-guardian',
    studentId: 'docs-student',
    relationship: 'parent',
  }))
  const family = app.forActor(createGuardianActorMetadata({
    schoolId: school.id,
    guardianId: 'docs-guardian',
    subjectId: 'docs-guardian-person',
    requestId: 'native-family-actor',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Verified,
  }))
  expect((await family.documentsWorkflow.listDocumentIssuances({ studentId: 'docs-student' })).some(item => item.id === issuance.id)).toBe(false)
  await expect(family.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).rejects.toThrow()
  await expect(family.documentsWorkflow.grantDocumentDownload({ id: 'guessed-issuance' })).rejects.toThrow()

  await dispatchDocumentRender(app)
  const listed = await family.documentsWorkflow.listDocumentIssuances({ studentId: 'docs-student' })
  expect(listed.some(item => item.id === issuance.id && item.status === DocumentIssuanceStatus.Ready)).toBe(true)
  expect(await family.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).toHaveProperty('downloadUrl')

  const voided = await staff.documentsWorkflow.voidDocumentIssuance({
    requestId: 'native-void',
    issuanceId: issuance.id,
    reason: 'Reissued on paper',
  })
  expect(voided.status).toBe(DocumentIssuanceStatus.Voided)
  await expect(family.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).rejects.toThrow()
  expect((await family.documentsWorkflow.listDocumentIssuances({ studentId: 'docs-student' })).map(item => item.id)).not.toContain(issuance.id)
}, 30000)

test('mixed-audience batches omit unauthorized items without leaking artifacts', async () => {
  const staff = application(0).forActor(actor)
  const result = await staff.documentsWorkflow.requestDocumentIssuanceBatch({
    requestId: 'native-batch',
    templateKey: 'schooling-certificate.v1',
    items: [
      { sourceId: 'docs-enrollment', requestId: 'native-batch-a' },
      { sourceId: 'missing-enrollment', requestId: 'native-batch-denied' },
    ],
  })
  expect(result.items.map(item => item.status).sort()).toEqual(['denied', 'requested'])
  expect(result.items.find(item => item.status === 'denied')?.failureCode).toBeTruthy()
}, 30000)

test('renderer outage marks failed work and retry restores a ready artifact', async () => {
  const failingApp = new SchoolApplication({ repositories, atomicExecution: new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handles[0]!.db as Executor), documentRenderer: {
    async render() {
      throw new Error('gotenberg down')
    },
  }, notificationGateway: noOpNotificationGateway, fileStorage: storage })
  const staff = failingApp.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-render-fail',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  await dispatchDocumentRender(failingApp)
  expect((await repositories.documentIssuances.findById(issuance.id))?.status).toBe(DocumentIssuanceStatus.Failed)
  expect((await repositories.documentIssuances.findById(issuance.id))?.failureCode).toBe(DOCUMENT_FAILURES.RENDER_UNAVAILABLE)

  await staff.documentsWorkflow.retryDocumentIssuance({
    requestId: 'native-render-retry',
    issuanceId: issuance.id,
  })
  await dispatchDocumentRender(application(0))
  const ready = await repositories.documentIssuances.findById(issuance.id)
  expect(ready?.status).toBe(DocumentIssuanceStatus.Ready)
  expect(ready?.artifactAttachmentId).toBeTruthy()
}, 30000)

test('closing an enrollment while render is queued cannot become downloadable', async () => {
  const app = application(0)
  const staff = app.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-mid-unpublish',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment-b',
  })
  const enrollment = await repositories.enrollments.findById('docs-enrollment-b')
  await repositories.enrollments.save(enrollment!.close({
    endedAt: new Date('2026-06-01'),
    endReason: EnrollmentEndReason.Withdrawn,
    closedBy: actor.staffMemberId,
  }))
  await dispatchDocumentRender(app)
  const stored = await repositories.documentIssuances.findById(issuance.id)
  expect(stored?.status).toBe(DocumentIssuanceStatus.Failed)
  expect(stored?.failureCode).toBe(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED)
  await expect(staff.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).rejects.toThrow()
}, 30000)

test('storage outage marks failed work; retry after storage recovers becomes ready', async () => {
  let failStorage = true
  const failingStorage = {
    ...storage,
    async putObject(input: Parameters<typeof storage.putObject>[0]) {
      if (failStorage)
        throw new Error('r2 down')
      return storage.putObject(input)
    },
  }
  const failingApp = new SchoolApplication({ repositories, atomicExecution: new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handles[0]!.db as Executor), documentRenderer: {
    async render() {
      return { bytes: pdf, contentType: 'application/pdf', sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', renderId: 'native-storage' }
    },
  }, notificationGateway: noOpNotificationGateway, fileStorage: failingStorage })
  const staff = failingApp.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-storage-fail',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  await dispatchDocumentRender(failingApp)
  expect((await repositories.documentIssuances.findById(issuance.id))?.status).toBe(DocumentIssuanceStatus.Failed)
  expect((await repositories.documentIssuances.findById(issuance.id))?.failureCode).toBe(DOCUMENT_FAILURES.STORAGE_UNAVAILABLE)

  failStorage = false
  await staff.documentsWorkflow.retryDocumentIssuance({
    requestId: 'native-storage-retry',
    issuanceId: issuance.id,
  })
  await dispatchDocumentRender(failingApp)
  expect((await repositories.documentIssuances.findById(issuance.id))?.status).toBe(DocumentIssuanceStatus.Ready)
}, 30000)

test('revoked family links and guessed artifact ids cannot download a ready issuance', async () => {
  const app = application(0)
  const staff = app.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-revoke',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })
  await dispatchDocumentRender(app)
  const ready = await repositories.documentIssuances.findById(issuance.id)
  expect(ready?.status).toBe(DocumentIssuanceStatus.Ready)

  await repositories.guardians.save(new Guardian({
    id: 'docs-guardian-revoke',
    schoolId: school.id,
    firstName: 'Revoked',
    lastName: 'Parent',
    subjectId: 'docs-guardian-revoke-person',
  }))
  await repositories.guardianLinks.save(new GuardianStudentLink({
    id: 'docs-link-revoke',
    schoolId: school.id,
    guardianId: 'docs-guardian-revoke',
    studentId: 'docs-student',
    relationship: 'parent',
  }))
  const family = app.forActor(createGuardianActorMetadata({
    schoolId: school.id,
    guardianId: 'docs-guardian-revoke',
    subjectId: 'docs-guardian-revoke-person',
    requestId: 'native-revoke-actor',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Verified,
  }))
  expect(await family.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).toHaveProperty('downloadUrl')
  await repositories.guardianLinks.delete('docs-link-revoke')
  await expect(family.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).rejects.toThrow()
  const familyArtifact = await grantAttachmentDownload(family.baseService, ready!.artifactAttachmentId!).catch(() => null)
  expect(familyArtifact).toBeNull()
  expect(await grantAttachmentDownload(staff.baseService, 'guessed-attachment')).toBeNull()
}, 30000)

test('a crash after putObject and before bind leaves the issuance failed and not downloadable', async () => {
  await repositories.students.save(new Student({ id: 'docs-student-c', schoolId: school.id, firstName: 'Katherine', lastName: 'Johnson' }))
  await repositories.enrollments.save(new StudentClassEnrollment({
    id: 'docs-enrollment-c',
    studentId: 'docs-student-c',
    classGroupId: 'docs-class',
    academicYearId: 'docs-year',
    enrollmentIndex: 1,
    enrolledAt: new Date('2026-01-17'),
  }))
  const wrappingStorage = {
    ...storage,
    async putObject(input: Parameters<typeof storage.putObject>[0]) {
      const result = await storage.putObject(input)
      const student = await repositories.students.findById('docs-student-c')
      await repositories.students.save(new Student({ ...student!.data, lastName: 'Changed' }))
      return result
    },
  }
  const crashApp = new SchoolApplication({ repositories, atomicExecution: new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handles[0]!.db as Executor), documentRenderer: {
    async render() {
      return { bytes: pdf, contentType: 'application/pdf', sha256: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', renderId: 'native-crash' }
    },
  }, notificationGateway: noOpNotificationGateway, fileStorage: wrappingStorage })
  const staff = crashApp.forActor(actor)
  const issuance = await staff.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-crash-bind',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment-c',
  })
  await dispatchDocumentRender(crashApp)
  const stored = await repositories.documentIssuances.findById(issuance.id)
  expect(stored?.status).toBe(DocumentIssuanceStatus.Failed)
  expect(stored?.failureCode).toBe(DOCUMENT_FAILURES.SOURCE_CHANGED)
  expect(stored?.artifactAttachmentId).toBeUndefined()
  await expect(staff.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).rejects.toThrow()
}, 30000)

test('an unrelated teacher cannot issue family or unassigned-class documents', async () => {
  await repositories.teachers.save(new Teacher({
    id: 'docs-teacher',
    schoolId: school.id,
    firstName: 'Unrelated',
    lastName: 'Teacher',
    subjectId: 'docs-teacher-person',
  }))
  const teacher = application(0).forActor(createTeacherActorMetadata({
    schoolId: school.id,
    teacherId: 'docs-teacher',
    subjectId: 'docs-teacher-person',
    requestId: 'native-teacher',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Verified,
  }))
  await expect(teacher.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-teacher-cert',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'docs-enrollment',
  })).rejects.toThrow()
  await expect(teacher.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-teacher-roster',
    templateKey: 'class-roster.v1',
    sourceId: 'docs-class',
    classGroupId: 'docs-class',
  })).rejects.toThrow()
}, 30000)
