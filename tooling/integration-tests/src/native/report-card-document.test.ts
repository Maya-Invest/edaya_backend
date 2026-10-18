import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, PostgresSchoolRepositories, transactionContext } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicPeriod, AcademicYear, Attachment, AttachmentOwnerKind, AttachmentStatus, ClassGroup, ClassSubject, DocumentIssuanceStatus, GradeLevel, GradeScale, LessonSession, noOpFileStorage, noOpNotificationGateway, ReportCardDefinition, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, School, StaffMember, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { dispatchDocumentRender, grantAttachmentDownload, renderReportCardDocument, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
interface Executor { execute: (query: SQL) => Promise<unknown> }
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const stores = handles.map(handle => new PostgresSchoolRepositories(handle.db))
const repositories = stores[0]!
const actor = createStaffActorMetadata({ schoolId: 'report-school', staffMemberId: 'report-staff', subjectId: 'report-owner', academicYearId: 'report-year', requestId: 'native-report', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
const school = new School({ id: actor.schoolId, name: 'Report fixture', timeZone: 'UTC', ownerSubjectId: actor.subjectId })
const bytes = new Uint8Array(4096)
const rendered = { bytes, sha256: 'synthetic-digest', contentType: 'application/pdf', renderId: 'native-render' }

beforeAll(async () => {
  await repositories.init({ driver: 'node-postgres' })
  await repositories.schools.save(school)
  await repositories.staffMembers.save(new StaffMember({ id: actor.staffMemberId, schoolId: school.id, firstName: 'Report', lastName: 'Owner', subjectId: actor.subjectId }))
  const dates = { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }
  await repositories.academicYears.save(new AcademicYear({ id: 'report-year', schoolId: school.id, name: '2026', status: 'published', ...dates }))
  await repositories.academicPeriods.save(new AcademicPeriod({ id: 'report-period', schoolId: school.id, academicYearId: 'report-year', name: 'Term', isPublished: true, ...dates }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'report-grade', schoolId: school.id, name: 'Grade', label: 'Grade', order: 1 }))
  await repositories.classGroups.save(new ClassGroup({ id: 'report-class', schoolId: school.id, academicYearId: 'report-year', gradeLevelId: 'report-grade', name: 'Class' }))
  await repositories.subjects.save(new Subject({ gradeLevelId: 'report-grade', academicYearId: 'report-year', id: 'report-math', schoolId: school.id, name: 'Math' }))
  await repositories.classSubjects.save(new ClassSubject({ id: 'report-math-class', classGroupId: 'report-class', subjectId: 'report-math' }))
  await repositories.students.save(new Student({ id: 'report-student', schoolId: school.id, firstName: 'Synthetic', lastName: 'Student' }))
  await repositories.enrollments.save(new StudentClassEnrollment({ id: 'report-enrollment', studentId: 'report-student', classGroupId: 'report-class', academicYearId: 'report-year', enrollmentIndex: 1 }))
  await repositories.gradeScales.save(new GradeScale({ id: 'report-scale', schoolId: school.id, name: '20 points', minScore: 0, maxScore: 20, ranges: [{ letter: 'A', minScore: 0, maxScore: 20 }] }))
  await repositories.definitions.save(new ReportCardDefinition({ id: 'report-definition', schoolId: school.id, academicYearId: 'report-year', gradeLevelId: 'report-grade', gradeScaleId: 'report-scale', name: 'Report' }))
}, 30000)
afterAll(() => Promise.all(handles.map(handle => handle.dispose())))

async function result(id: string) {
  const value = new ReportCardResult({ id, reportCardDefinitionId: 'report-definition', studentId: 'report-student', classGroupId: 'report-class', periodId: 'report-period', status: ReportCardResultStatus.Published, publishedAt: new Date(), assessmentResultCount: 1, overallAverage: 12, attendanceSummary: { presentCount: 20, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 }, sectionResults: [new ReportCardResultSection({ sectionId: 'math', classSubjectId: 'report-math-class', sectionKind: ReportCardDefinitionSectionKind.Subject, name: 'Math', average: 12, weight: 1 })] })
  await repositories.results.save(value)
  return value
}

function generator(index: number, onPut: () => Promise<void> = async () => {}, failCommit: () => boolean = () => false) {
  const handle = handles[index]!
  const repos = stores[index]!
  const atomic = new PostgresAtomicExecution(handle.db as PostgresTransactionalDb)
  const outsideTransaction = async () => {
    expect(transactionContext.getStore()).toBeUndefined()
    // The pool has one connection: this query deadlocks if rendering/storage retains it.
    expect((await repos.schools.findById(school.id))?.id).toBe(school.id)
  }
  const service = new SchoolApplication({
    repositories: repos,
    atomicExecution: {
      execute: (operation, options) => atomic.execute(async () => {
        const value = await operation()
        if (failCommit())
          throw new Error('Injected final commit failure')
        return value
      }, options),
    },
    notificationGateway: noOpNotificationGateway,
    fileStorage: {
      ...noOpFileStorage,
      async putObject() {
        await outsideTransaction()
        await onPut()
        return { sizeBytes: bytes.byteLength }
      },
    },
  }).forActor(actor)
  return (resultId: string) => renderReportCardDocument(service, {
    resultId,
    renderer: { async render() {
      await outsideTransaction()
      return rendered
    } },
  })
}

test('concurrent report renderers release their one-connection pools and publish one attachment', async () => {
  const report = await result('report-concurrent')
  let uploads = 0
  let release!: () => void
  const bothUploaded = new Promise<void>((resolve) => {
    release = resolve
  })
  const onPut = async () => {
    if (++uploads === 2)
      release()
    await bothUploaded
  }
  const outcomes = await Promise.all([generator(0, onPut)(report.id), generator(1, onPut)(report.id)])
  expect(uploads).toBe(2)
  expect(outcomes[0]).toEqual(outcomes[1])
  expect(await repositories.attachments.count({ ownerKind: AttachmentOwnerKind.ReportCard, ownerId: report.id })).toBe(1)
}, 30000)

test('revoking authority during storage prevents attachment publication', async () => {
  const report = await result('report-revoked')
  try {
    await expect(generator(0, async () => {
      await repositories.schools.save(new School({ ...school.data, ownerSubjectId: 'another-owner' }))
    })(report.id)).rejects.toThrow()
    expect(await repositories.attachments.count({ ownerId: report.id })).toBe(0)
  }
  finally {
    await repositories.schools.save(school)
  }
}, 30000)

test('final transaction failure rolls back stub status and new attachment together', async () => {
  const report = await result('report-rollback')
  const stub = new Attachment({ id: 'report-stub', schoolId: school.id, ownerKind: AttachmentOwnerKind.ReportCard, ownerId: report.id, fileName: 'stub.pdf', storageKey: 'report-school/stub.pdf', mimeType: 'application/pdf', sizeBytes: 100, status: AttachmentStatus.Ready })
  await repositories.attachments.save(stub)
  let uploaded = false
  await expect(generator(0, async () => {
    uploaded = true
  }, () => uploaded)(report.id)).rejects.toThrow('Injected final commit failure')
  expect((await repositories.attachments.findById(stub.id))?.status).toBe(AttachmentStatus.Ready)
  expect(await repositories.attachments.count({ ownerId: report.id })).toBe(1)
  await expect(generator(0)(report.id)).resolves.toHaveProperty('attachmentId')
  expect((await repositories.attachments.findById(stub.id))?.status).toBe(AttachmentStatus.Failed)
  expect(await repositories.attachments.count({ ownerId: report.id })).toBe(2)
}, 30000)

test('logbook issuance render and download grants release the pool connection during external calls', async () => {
  let externalCalls = 0
  const outsideTransaction = async () => {
    expect(transactionContext.getStore()).toBeUndefined()
    expect((await repositories.schools.findById(school.id))?.id).toBe(school.id)
    externalCalls++
  }
  await repositories.lessonSessions.save(new LessonSession({ id: 'report-logbook-session', schoolId: school.id, classGroupId: 'report-class', classSubjectId: 'report-math-class', displayLabel: 'Synthetic math', sessionNote: 'Synthetic lesson', startsAt: new Date('2026-05-01T08:00:00Z'), endsAt: new Date('2026-05-01T09:00:00Z') }))
  const download = new Attachment({ id: 'report-download-fixture', schoolId: school.id, ownerKind: AttachmentOwnerKind.Staff, ownerId: actor.staffMemberId, fileName: 'download.pdf', storageKey: 'report-school/download.pdf', mimeType: 'application/pdf' })
  await repositories.attachments.save(download)
  const app = new SchoolApplication({
    repositories,
    atomicExecution: new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb),
    commandJournal: new PostgresCommandJournal(),
    durableWork: new PostgresDurableWork(handles[0]!.db as Executor),
    documentRenderer: {
      async render() {
        await outsideTransaction()
        return rendered
      },
    },
    notificationGateway: noOpNotificationGateway,
    fileStorage: {
      ...noOpFileStorage,
      async putObject() {
        await outsideTransaction()
        return { sizeBytes: bytes.byteLength }
      },
      async createPresignedDownload() {
        await outsideTransaction()
        return { downloadUrl: 'https://files.invalid/synthetic.pdf', expiresAt: new Date(Date.now() + 900000) }
      },
    },
  })
  const service = app.forActor(actor)
  const issuance = await service.documentsWorkflow.requestDocumentIssuance({
    requestId: 'native-logbook',
    templateKey: 'logbook.v1',
    sourceId: 'report-class',
    academicPeriodId: 'report-period',
  })
  await dispatchDocumentRender(app)
  expect((await repositories.documentIssuances.findById(issuance.id))?.status).toBe(DocumentIssuanceStatus.Ready)
  expect(await service.documentsWorkflow.grantDocumentDownload({ id: issuance.id })).toHaveProperty('downloadUrl')
  expect(await grantAttachmentDownload(service.baseService, download.id)).toHaveProperty('downloadUrl')
  expect(externalCalls).toBe(4)
}, 30000)
