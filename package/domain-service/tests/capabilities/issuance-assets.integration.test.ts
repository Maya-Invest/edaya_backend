import type {
  SCHOOL_SIGNATURE_PURPOSE,
} from '@edaya/core'
import { AuthorizationError, createGuardianActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import {
  AttachmentStatus,
  createInMemoryFileStorage,
  DocumentAudience,
  DocumentIssuance,
  DocumentIssuanceStatus,
  DocumentSourceType,
  Guardian,
  GuardianStudentLink,
  School,
  SCHOOL_CREST_PURPOSE,
  SCHOOL_ISSUANCE_ASSET_TERMINAL_RETAIN_MS,
  SCHOOL_LOGO_PURPOSE,
  SCHOOL_STAMP_PURPOSE,
  Student,
  Teacher,
} from '@edaya/core'
import { grantAttachmentDownload, hydrateDocumentPayload, resolveAttachmentReadPolicy, retainIssuanceSnapshotAssets } from '@edaya/service'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'

const jpeg = await Bun.file(new URL('../fixtures/upload-formats/synthetic.jpg', import.meta.url)).bytes()

describe('school issuance assets', () => {
  let fixture: Awaited<ReturnType<typeof createTestApp>>
  let storage: ReturnType<typeof createInMemoryFileStorage>

  beforeEach(async () => {
    storage = createInMemoryFileStorage()
    fixture = await createTestApp(undefined, { fileStorage: storage })
    await fixture.schoolRepositories.students.save(new Student({
      id: 'stu1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'gua1',
      schoolId: 'school',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'gua-subject',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link-1',
      schoolId: 'school',
      guardianId: 'gua1',
      studentId: 'stu1',
      relationship: 'parent',
    }))
    await fixture.schoolRepositories.teachers.save(new Teacher({
      id: 'teacher-a',
      schoolId: 'school',
      firstName: 'Alan',
      lastName: 'Turing',
      subjectId: 'teacher-subject',
    }))
  })

  function family() {
    return fixture.forActor(createGuardianActorMetadata({
      schoolId: 'school',
      guardianId: 'gua1',
      subjectId: 'gua-subject',
      requestId: 'family-branding',
      authenticatedAt: new Date(),
    }))
  }

  function teacher() {
    return fixture.forActor(createTeacherActorMetadata({
      schoolId: 'school',
      teacherId: 'teacher-a',
      subjectId: 'teacher-subject',
      requestId: 'teacher-branding',
      authenticatedAt: new Date(),
    }))
  }

  async function completeAsset(purpose: typeof SCHOOL_LOGO_PURPOSE | typeof SCHOOL_CREST_PURPOSE | typeof SCHOOL_STAMP_PURPOSE | typeof SCHOOL_SIGNATURE_PURPOSE, attachmentId: string) {
    const intent = await fixture.app.documentsWorkflow.createSchoolIssuanceAssetUpload({
      purpose,
      attachmentId,
      fileName: `${purpose.replace('.', '-')}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: jpeg.byteLength,
    })
    await storage.putObject({ key: intent.storageKey, body: jpeg, contentType: 'image/jpeg' })
    const record = (await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!
    return fixture.app.documentsWorkflow.completeSchoolIssuanceAssetUpload({
      ...record.attachment,
      status: AttachmentStatus.Ready,
      purpose,
    })
  }

  async function preview(attachmentId: string, actor = fixture.app) {
    const access = await resolveAttachmentReadPolicy(actor.baseService, attachmentId)
    return grantAttachmentDownload(actor.baseService, attachmentId, { access, inlineImages: true })
  }

  test('updateSchoolConfiguration persists and clears issuing identity', async () => {
    const updated = await fixture.app.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'school',
      issuingName: 'Collège Edaya Cocody',
      postalAddress: 'Cocody, Abidjan',
      phone: '+225 01 02 03 04',
      email: 'secretariat@edaya.test',
      schoolCode: 'EDAYA-CI',
    })
    expect(updated.issuingName).toBe('Collège Edaya Cocody')
    expect(updated.postalAddress).toBe('Cocody, Abidjan')
    expect(updated.phone).toBe('+225 01 02 03 04')
    expect(updated.email).toBe('secretariat@edaya.test')
    expect(updated.schoolCode).toBe('EDAYA-CI')

    const cleared = await fixture.app.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'school',
      issuingName: '',
      postalAddress: null,
    })
    expect(cleared.issuingName).toBeUndefined()
    expect(cleared.postalAddress).toBeUndefined()
    expect(cleared.phone).toBe('+225 01 02 03 04')
  })

  test('staff can upload, preview, replace, and clear issuance assets', async () => {
    const logo = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-logo')
    const school = await fixture.schoolRepositories.schools.findById('school')
    expect(school?.logoAttachmentId).toBe(logo.id)
    expect(school?.issuanceAssetVersion).toBe(1)
    expect(await preview(logo.id)).toBeTruthy()

    const replacement = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-logo-2')
    const afterReplace = await fixture.schoolRepositories.schools.findById('school')
    expect(afterReplace?.logoAttachmentId).toBe(replacement.id)
    expect(afterReplace?.issuanceAssetVersion).toBe(2)
    expect(await fixture.schoolRepositories.attachments.findById(logo.id)).toBeUndefined()

    await fixture.app.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'school',
      publicBrandingPurposes: [SCHOOL_LOGO_PURPOSE],
    })
    const cleared = await fixture.app.documentsWorkflow.clearSchoolIssuanceAsset({ purpose: SCHOOL_LOGO_PURPOSE })
    expect(cleared.logoAttachmentId).toBeUndefined()
    expect(cleared.issuanceAssetVersion).toBe(3)
    expect(cleared.publicBrandingPurposes).toEqual([])
  })

  test('logo and crest become family/teacher readable only after explicit allowlisting; stamps never do', async () => {
    const logo = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-public-logo')
    const stamp = await completeAsset(SCHOOL_STAMP_PURPOSE, 'att-stamp')
    await expect(preview(logo.id, family())).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview(logo.id, teacher())).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview(stamp.id, family())).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview(stamp.id, teacher())).rejects.toBeInstanceOf(AuthorizationError)

    await fixture.app.setupWorkflow.updateSchoolConfiguration({
      schoolId: 'school',
      publicBrandingPurposes: [SCHOOL_LOGO_PURPOSE, SCHOOL_CREST_PURPOSE],
    })
    expect(await preview(logo.id, family())).toBeTruthy()
    expect(await preview(logo.id, teacher())).toBeTruthy()
    await expect(preview(stamp.id, family())).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview(stamp.id, teacher())).rejects.toBeInstanceOf(AuthorizationError)
    expect(await grantAttachmentDownload(family().baseService, 'guessed-attachment')).toBeNull()
    expect(await preview(stamp.id, fixture.app)).toBeTruthy()
  })

  test('replaced branding bytes referenced by an issued document are retained', async () => {
    const logo = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-snapshot-logo')
    await fixture.schoolRepositories.documentIssuances.save(new DocumentIssuance({
      id: 'iss-1',
      schoolId: 'school',
      templateKey: 'schooling-certificate.v1',
      templateVersion: '1',
      locale: 'fr',
      academicYearId: 'year-1',
      sourceType: DocumentSourceType.Student,
      sourceId: 'stu1',
      sourceVersion: '1',
      snapshot: {
        facts: { schoolName: 'Fixture school' },
        sourceVersion: '1',
        locale: 'fr',
        timeZone: 'UTC',
        logoAttachmentId: logo.id,
      },
      issuerActorId: 'admin',
      audience: DocumentAudience.Staff,
      requestId: 'req-cert',
      status: DocumentIssuanceStatus.Ready,
    }))
    await fixture.app.baseService.atomicExecution.execute(async () => {
      await retainIssuanceSnapshotAssets(fixture.app.baseService, 'iss-1', {
        facts: { schoolName: 'Fixture school' },
        sourceVersion: '1',
        locale: 'fr',
        timeZone: 'UTC',
        logoAttachmentId: logo.id,
      })
    })

    const replacement = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-snapshot-logo-2')
    expect((await fixture.schoolRepositories.schools.findById('school'))?.logoAttachmentId).toBe(replacement.id)
    expect(await fixture.schoolRepositories.attachments.findById(logo.id)).toBeDefined()

    const renderer = fixture.forActor(createSystemActorMetadata({
      schoolId: 'school',
      systemId: 'document-render',
      requestId: 'hydrate',
      reason: 'test',
    }))
    const issuance = (await fixture.schoolRepositories.documentIssuances.findById('iss-1'))!
    const hydrated = await hydrateDocumentPayload(renderer.baseService, issuance)
    const payload = hydrated.input.payload as { logoUrl?: unknown }
    expect(String(payload.logoUrl ?? '')).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('hydrate puts the principal stamp on report-card council, not letter payload roots', async () => {
    const stamp = await completeAsset(SCHOOL_STAMP_PURPOSE, 'att-hydrate-stamp')
    const renderer = fixture.forActor(createSystemActorMetadata({
      schoolId: 'school',
      systemId: 'document-render',
      requestId: 'hydrate-stamp',
      reason: 'test',
    }))

    await fixture.schoolRepositories.documentIssuances.save(new DocumentIssuance({
      id: 'iss-letter',
      schoolId: 'school',
      templateKey: 'enrollment-record.v1',
      templateVersion: '1',
      locale: 'fr',
      academicYearId: 'year-1',
      sourceType: DocumentSourceType.Enrollment,
      sourceId: 'enr1',
      sourceVersion: '1',
      snapshot: {
        facts: { studentName: 'Ada Lovelace', schoolName: 'Fixture school', schoolYear: '2026-2027' },
        sourceVersion: '1',
        locale: 'fr',
        timeZone: 'UTC',
        stampAttachmentId: stamp.id,
      },
      issuerActorId: 'admin',
      audience: DocumentAudience.Staff,
      requestId: 'req-letter',
      status: DocumentIssuanceStatus.Requested,
    }))
    const letter = (await fixture.schoolRepositories.documentIssuances.findById('iss-letter'))!
    const letterPayload = (await hydrateDocumentPayload(renderer.baseService, letter)).input.payload as {
      stampUrl?: unknown
    }
    expect(String(letterPayload.stampUrl ?? '')).toMatch(/^data:image\/jpeg;base64,/)
    expect(letterPayload).not.toHaveProperty('principalStampUrl')

    await fixture.schoolRepositories.documentIssuances.save(new DocumentIssuance({
      id: 'iss-bulletin',
      schoolId: 'school',
      templateKey: 'report-card.v1',
      templateVersion: '1',
      locale: 'fr',
      academicYearId: 'year-1',
      sourceType: DocumentSourceType.ReportCardResult,
      sourceId: 'rcr1',
      sourceVersion: '1',
      snapshot: {
        facts: {
          studentName: 'Ada Lovelace',
          schoolName: 'Fixture school',
          periodLabel: 'T1',
          subjects: [{ name: 'Maths', kind: 'subject' }],
          council: { principalName: 'Jean Aka' },
        },
        sourceVersion: '1',
        locale: 'fr',
        timeZone: 'UTC',
        stampAttachmentId: stamp.id,
      },
      issuerActorId: 'admin',
      audience: DocumentAudience.Staff,
      requestId: 'req-bulletin',
      status: DocumentIssuanceStatus.Requested,
    }))
    const bulletin = (await fixture.schoolRepositories.documentIssuances.findById('iss-bulletin'))!
    const bulletinPayload = (await hydrateDocumentPayload(renderer.baseService, bulletin)).input.payload as {
      stampUrl?: unknown
      principalStampUrl?: unknown
      council?: { principalStampUrl?: unknown, principalName?: unknown }
    }
    expect(String(bulletinPayload.stampUrl ?? '')).toMatch(/^data:image\/jpeg;base64,/)
    expect(bulletinPayload).not.toHaveProperty('principalStampUrl')
    expect(bulletinPayload.council?.principalName).toBe('Jean Aka')
    expect(String(bulletinPayload.council?.principalStampUrl ?? '')).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('generic school save cannot rewrite issuance slots', async () => {
    const logo = await completeAsset(SCHOOL_LOGO_PURPOSE, 'att-locked')
    const existing = (await fixture.schoolRepositories.schools.findById('school'))!
    await expect(fixture.app.baseService.entities.schools.save(new School({
      ...existing.data,
      logoAttachmentId: 'forged',
      issuanceAssetVersion: 99,
    }))).rejects.toMatchObject({ code: 'SCHOOL_ISSUANCE_ASSETS_COMMAND_OWNED' })
    expect((await fixture.schoolRepositories.schools.findById('school'))?.logoAttachmentId).toBe(logo.id)
  })

  test('unreferenced replacement is reserved for the 30-day window', async () => {
    const first = await completeAsset(SCHOOL_CREST_PURPOSE, 'att-crest-1')
    await completeAsset(SCHOOL_CREST_PURPOSE, 'att-crest-2')
    const { rows } = await fixture.db.query<{ remaining_ms: string }>(
      `SELECT (EXTRACT(EPOCH FROM (protected_until - clock_timestamp())) * 1000)::bigint AS remaining_ms
       FROM private_file_objects WHERE storage_key = '${first.storageKey!.replaceAll('\'', '\'\'')}'`,
    )
    expect(Number(rows[0]?.remaining_ms)).toBeGreaterThan(SCHOOL_ISSUANCE_ASSET_TERMINAL_RETAIN_MS - 15_000)
  })
})
