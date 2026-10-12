import { ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata } from '@edaya/authorization'
import { AcademicYear, AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError, ClassGroup, createInMemoryFileStorage, DocumentIssuanceStatus, GradeLevel, Guardian, GuardianStudentLink, LessonSession, Student, StudentClassEnrollment, Teacher } from '@edaya/core'
import { dispatchDocumentRender, resolveAttachmentReadPolicy } from '@edaya/service'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

const NOW = new Date('2026-04-15T10:00:00Z')
const PDF = new TextEncoder().encode('%PDF-1.4 official-test')

function renderer() {
  return {
    async render() {
      return {
        bytes: PDF,
        contentType: 'application/pdf' as const,
        sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        renderId: 'rnd_test',
      }
    },
  }
}

async function seedSchooling(repositories: Awaited<ReturnType<typeof createTestApp>>['schoolRepositories']) {
  await repositories.academicYears.save(new AcademicYear({
    id: 'ay1',
    schoolId: 'sch1',
    name: '2025-2026',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-06-30'),
    status: 'published',
  }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'grade1', schoolId: 'sch1', name: 'Grade 1', label: '1', order: 1 }))
  await repositories.classGroups.save(new ClassGroup({ id: 'cg1', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'CM1 A' }))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace', birthDate: new Date('2010-01-01') }))
  await repositories.enrollments.save(new StudentClassEnrollment({
    id: 'enr1',
    studentId: 'stu1',
    classGroupId: 'cg1',
    academicYearId: 'ay1',
    enrollmentIndex: 1,
    enrolledAt: new Date('2025-09-01'),
  }))
}

describe('DocumentsServiceWorkflow', () => {
  test('requestDocumentIssuance numbers certificates and dispatchDocumentRender stores a private PDF', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const { app, application, schoolRepositories } = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(schoolRepositories)

    const first = await app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-cert-1',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    expect(first.status).toBe(DocumentIssuanceStatus.Requested)
    expect(first.number).toBe('SCHOOLIN-2025-2026-000001')

    await schoolRepositories.students.save(new Student({ id: 'stu2', schoolId: 'sch1', firstName: 'Alan', lastName: 'Turing', birthDate: new Date('2011-02-02') }))
    await schoolRepositories.enrollments.save(new StudentClassEnrollment({
      id: 'enr2',
      studentId: 'stu2',
      classGroupId: 'cg1',
      academicYearId: 'ay1',
      enrollmentIndex: 1,
      enrolledAt: new Date('2025-09-01'),
    }))
    const second = await app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-cert-2',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr2',
    })
    expect(second.number).toBe('SCHOOLIN-2025-2026-000002')

    await dispatchDocumentRender(application)

    const ready = await schoolRepositories.documentIssuances.findById(first.id)
    expect(ready?.status).toBe(DocumentIssuanceStatus.Ready)
    expect(ready?.artifactAttachmentId).toBeTruthy()
    const attachment = await schoolRepositories.attachments.findById(ready!.artifactAttachmentId!)
    expect(attachment?.status).toBe(AttachmentStatus.Ready)
    expect(attachment?.ownerKind).toBe(AttachmentOwnerKind.DocumentIssuance)
    expect(attachment?.purpose).toBe('document.issuance')
    expect((await resolveAttachmentReadPolicy(app.baseService, attachment!.id))?.purpose).toBe('document.issuance')
  })

  test('retry with a changed snapshot conflicts; same snapshot is idempotent', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const { app, schoolRepositories } = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(schoolRepositories)

    const first = await app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-same',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    const again = await app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-same',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    expect(again.id).toBe(first.id)
    expect(again.number).toBe(first.number)

    const stored = (await schoolRepositories.documentIssuances.findById(first.id))!
    await schoolRepositories.documentIssuances.save(stored.copyWith({
      status: DocumentIssuanceStatus.Failed,
      failureCode: 'DOCUMENT_RENDER_UNAVAILABLE',
      updatedAt: new Date(),
    }))
    const student = (await schoolRepositories.students.findById('stu1'))!
    await schoolRepositories.students.save(new Student({ ...student.data, lastName: 'Changed' }))
    await expect(app.documentsWorkflow.retryDocumentIssuance({
      requestId: 'req-retry',
      issuanceId: first.id,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('previewDocument is watermarked, unnumbered, and never ready', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const { app, application, schoolRepositories } = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(schoolRepositories)

    const preview = await app.documentsWorkflow.previewDocument({
      requestId: 'req-preview',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    expect(preview.number).toBeUndefined()
    expect(preview.status).toBe(DocumentIssuanceStatus.Requested)

    await dispatchDocumentRender(application)
    const stored = await schoolRepositories.documentIssuances.findById(preview.id)
    expect(stored?.status).toBe(DocumentIssuanceStatus.Preview)
    expect(stored?.number).toBeUndefined()
  })

  test('family list and download expose only current ready issuances for linked students', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const fixture = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(fixture.schoolRepositories)
    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'gua1',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'subject-gua1',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link1',
      schoolId: 'sch1',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'parent',
    }))

    const requested = await fixture.app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-family-1',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })

    const family = createGuardianActorMetadata({
      schoolId: 'sch1',
      guardianId: 'gua1',
      subjectId: 'subject-gua1',
      requestId: 'family-docs',
      authenticatedAt: NOW,
      assuranceLevel: ActorAssuranceLevel.Verified,
    })
    const familyApp = fixture.forActor(family)

    expect(await familyApp.documentsWorkflow.listDocumentIssuances({ studentId: 'stu1' })).toEqual([])

    await dispatchDocumentRender(fixture.application)

    const listed = await familyApp.documentsWorkflow.listDocumentIssuances({ studentId: 'stu1' })
    expect(listed.map(item => item.id)).toEqual([requested.id])
    const grant = await familyApp.documentsWorkflow.grantDocumentDownload({ id: requested.id })
    expect(grant.downloadUrl).toContain('memory://')

    const later = await fixture.app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-family-fail',
      templateKey: 'enrollment-record.v1',
      sourceId: 'enr1',
    })
    const storedLater = (await fixture.schoolRepositories.documentIssuances.findById(later.id))!
    await fixture.schoolRepositories.documentIssuances.save(storedLater.copyWith({
      status: DocumentIssuanceStatus.Failed,
      failureCode: 'DOCUMENT_RENDER_UNAVAILABLE',
      updatedAt: new Date(NOW.getTime() + 3_000),
    }))
    expect((await familyApp.documentsWorkflow.listDocumentIssuances({ studentId: 'stu1' })).map(item => item.id)).toEqual([requested.id])
    await expect(familyApp.documentsWorkflow.grantDocumentDownload({ id: later.id })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('voidDocumentIssuance is staff-only and hides the row from family lists', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const fixture = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(fixture.schoolRepositories)
    const issuance = await fixture.app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-void',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    await dispatchDocumentRender(fixture.application)

    const voided = await fixture.app.documentsWorkflow.voidDocumentIssuance({
      requestId: 'void-1',
      issuanceId: issuance.id,
      reason: 'Wrong class',
    })
    expect(voided.status).toBe(DocumentIssuanceStatus.Voided)
    expect(voided.voidReason).toBe('Wrong class')

    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'gua1',
      schoolId: 'sch1',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'subject-gua1',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link1',
      schoolId: 'sch1',
      guardianId: 'gua1',
      studentId: 'stu1',
    }))
    const family = createGuardianActorMetadata({
      schoolId: 'sch1',
      guardianId: 'gua1',
      subjectId: 'subject-gua1',
      requestId: 'family-void',
      authenticatedAt: NOW,
      assuranceLevel: ActorAssuranceLevel.Verified,
    })
    expect(await fixture.forActor(family).documentsWorkflow.listDocumentIssuances({ studentId: 'stu1' })).toEqual([])
  })

  test('invalid renderer payloads fail as DOCUMENT_INPUT_CONFLICT instead of RENDER_UNAVAILABLE', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const error = Object.assign(new Error('payload must NOT have additional properties'), {
      name: 'DocumentRenderError',
      code: 'document-rendering.invalid-payload',
    })
    const { app, application, schoolRepositories } = await createTestApp(staff, {
      owner: true,
      documentRenderer: {
        async render() {
          throw error
        },
      },
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(schoolRepositories)

    const issuance = await app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-invalid-payload',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })
    await dispatchDocumentRender(application)
    const failed = await schoolRepositories.documentIssuances.findById(issuance.id)
    expect(failed?.status).toBe(DocumentIssuanceStatus.Failed)
    expect(failed?.failureCode).toBe('DOCUMENT_INPUT_CONFLICT')
  })

  test('source-prerequisite gates reject missing enrollments and unpublished years', async () => {
    const staff = createTestStaffActor('sch1', 'user1')
    const { app, schoolRepositories } = await createTestApp(staff, {
      owner: true,
      documentRenderer: renderer(),
      fileStorage: createInMemoryFileStorage(),
    })
    await seedSchooling(schoolRepositories)
    await expect(app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-missing',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'missing',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const year = (await schoolRepositories.academicYears.findById('ay1'))!
    await schoolRepositories.academicYears.save(new AcademicYear({ ...year.data, status: 'draft' }))
    await expect(app.documentsWorkflow.requestDocumentIssuance({
      requestId: 'req-draft-year',
      templateKey: 'schooling-certificate.v1',
      sourceId: 'enr1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})

test('generated timetables issue class and teacher PDFs immediately without protecting replaceable lessons', async () => {
  const { regeneratableSessionIds } = await import('../../../src/capabilities/timetable/regeneration-protection')
  const { app, application, schoolRepositories: repositories } = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true, documentRenderer: renderer(), fileStorage: createInMemoryFileStorage() })
  await seedSchooling(repositories)
  await repositories.teachers.save(new Teacher({ id: 'teacher', schoolId: 'sch1', firstName: 'Ada', lastName: 'Teacher' }))
  const lesson = new LessonSession({ id: 'generated', schoolId: 'sch1', classGroupId: 'cg1', classSubjectId: 'math', timetableGenerated: true, timetableTeacherIds: ['teacher'], displayLabel: 'Math', startsAt: new Date('2026-04-15T08:00Z'), endsAt: new Date('2026-04-15T09:00Z') })
  await repositories.lessonSessions.save(lesson)
  const issued = []
  for (const templateKey of ['class-timetable.v1', 'teacher-timetable.v1'] as const) {
    const document = await app.documentsWorkflow.requestDocumentIssuance({ requestId: templateKey, templateKey, sourceId: templateKey === 'class-timetable.v1' ? 'cg1' : 'teacher', academicYearId: 'ay1' })
    issued.push(document)
    expect(document.status).toBe(DocumentIssuanceStatus.Requested)
  }
  await dispatchDocumentRender(application)
  for (const document of issued) {
    const ready = (await repositories.documentIssuances.findById(document.id))!
    expect(ready.status).toBe(DocumentIssuanceStatus.Ready)
    expect(ready.artifactAttachmentId).toBeTruthy()
  }
  expect(await regeneratableSessionIds(repositories, 'sch1', [lesson])).toEqual([lesson.id])
  const original = (await repositories.documentIssuances.findById(issued[0]!.id))!
  await repositories.lessonSessions.delete(lesson.id)
  await repositories.lessonSessions.save(lesson.copyWith({ id: 'replacement', displayLabel: 'Updated math' }))
  const refreshed = await app.documentsWorkflow.requestDocumentIssuance({ requestId: 'new-class-print', templateKey: 'class-timetable.v1', sourceId: 'cg1', academicYearId: 'ay1' })
  expect(refreshed.sourceVersion).not.toBe(original.sourceVersion)
  expect((await repositories.documentIssuances.findById(original.id))?.data).toEqual(original.data)
})
