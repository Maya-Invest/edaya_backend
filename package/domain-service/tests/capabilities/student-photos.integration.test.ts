import { AuthorizationError, createGuardianActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import {
  AttachmentOwnerKind,
  AttachmentStatus,
  BusinessRuleViolationError,
  createInMemoryFileStorage,
  Guardian,
  GuardianStudentLink,
  Student,
  STUDENT_PHOTO_ABANDONED_MS,
  STUDENT_PHOTO_TERMINAL_RETAIN_MS,
  StudentPhotoSubmissionStatus,
  Teacher,
} from '@edaya/core'
import { getStudentPortraitGrants, grantAttachmentDownload, resolveAttachmentReadPolicy, sweepExpiredStudentPortraitAttachments } from '@edaya/service'
import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'

const jpeg = await Bun.file(new URL('../fixtures/upload-formats/synthetic.jpg', import.meta.url)).bytes()

describe('student portrait review', () => {
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
  })

  function guardianService() {
    return fixture.forActor(createGuardianActorMetadata({
      schoolId: 'school',
      guardianId: 'gua1',
      subjectId: 'gua-subject',
      requestId: 'guardian-photo',
      authenticatedAt: new Date(),
    }))
  }

  async function completePortrait(input: {
    ownerKind: AttachmentOwnerKind
    ownerId: string
    attachmentId: string
    actor?: ReturnType<typeof fixture.forActor>
  }) {
    const service = input.actor ?? fixture.app
    const intent = await service.studentWorkflow.createProfilePhotoUpload({
      attachmentId: input.attachmentId,
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: jpeg.byteLength,
    })
    await storage.putObject({ key: intent.storageKey, body: jpeg, contentType: 'image/jpeg' })
    const record = (await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!
    return service.studentWorkflow.completeProfilePhotoUpload({
      ...record.attachment,
      status: AttachmentStatus.Ready,
    })
  }

  async function preview(attachmentId: string, actor = fixture.app) {
    const access = await resolveAttachmentReadPolicy(actor.baseService, attachmentId)
    return grantAttachmentDownload(actor.baseService, attachmentId, { access, inlineImages: true })
  }

  test('batch grants match published visible portraits and recheck a link revoked while signing', async () => {
    const photo = await completePortrait({ ownerKind: AttachmentOwnerKind.Student, ownerId: 'stu1', attachmentId: 'published' })
    await fixture.app.studentWorkflow.publishStudentPhoto({ requestId: 'publish', studentId: 'stu1', attachmentId: photo.id })
    const pending = await completePortrait({ ownerKind: AttachmentOwnerKind.Student, ownerId: 'stu1', attachmentId: 'pending', actor: guardianService() })
    await fixture.schoolRepositories.students.save(new Student({ id: 'unlinked', schoolId: 'school', firstName: 'Other', lastName: 'Student' }))
    const other = await completePortrait({ ownerKind: AttachmentOwnerKind.Student, ownerId: 'unlinked', attachmentId: 'other-portrait' })
    const otherRef = { studentId: 'unlinked', attachmentId: other.id }
    await fixture.app.studentWorkflow.publishStudentPhoto({ requestId: 'publish-other', ...otherRef })
    const guardian = guardianService().baseService
    const ref = { studentId: 'stu1', attachmentId: photo.id }
    const requested = [ref, ref, otherRef, { ...ref, attachmentId: pending.id }, { ...ref, studentId: 'foreign' }, { studentId: 'missing', attachmentId: 'missing' }]
    const original = storage.createPresignedDownload.bind(storage)
    const sign = spyOn(storage, 'createPresignedDownload')
    try {
      const { grants } = await getStudentPortraitGrants(guardian, requested)
      expect(grants.map(g => [g.studentId, g.attachmentId])).toEqual([['stu1', photo.id]])
      expect(sign).toHaveBeenCalledTimes(1)
      expect((await preview(photo.id, guardianService()))?.downloadUrl).toBeDefined()
      sign.mockImplementation(async (key, options) => {
        if (key === other.storageKey)
          throw new Error('test storage failure')
        return original(key, options)
      })
      const partial = await getStudentPortraitGrants(fixture.app.baseService, [ref, otherRef])
      expect(partial.grants.map(item => item.attachmentId)).toEqual([photo.id])
      sign.mockImplementationOnce(async (key, options) => {
        const signed = await original(key, options)
        await fixture.schoolRepositories.guardianLinks.delete('link-1')
        return signed
      })
      expect((await getStudentPortraitGrants(guardian, [ref])).grants).toEqual([])
      await expect(getStudentPortraitGrants(guardian, Array.from<typeof ref>({ length: 26 }).fill(ref))).rejects.toThrow()
    }
    finally {
      sign.mockRestore()
    }
  })

  test('staff publish sets the durable student portrait and generic profile photoUrl is ignored', async () => {
    const attachment = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-publish',
    })
    const published = await fixture.app.studentWorkflow.publishStudentPhoto({
      requestId: 'req-publish',
      studentId: 'stu1',
      attachmentId: attachment.id,
    })
    expect(published.photoAttachmentId).toBe(attachment.id)
    expect(published.photoUrl).toBe(`/core/files/${attachment.id}/content`)

    await fixture.app.studentWorkflow.updateStudentProfile({
      studentId: 'stu1',
      firstName: 'Augusta',
      photoUrl: '/core/files/forged/content',
    } as Parameters<typeof fixture.app.studentWorkflow.updateStudentProfile>[0] & { photoUrl: string })
    const student = await fixture.schoolRepositories.students.findById('stu1')
    expect(student?.firstName).toBe('Augusta')
    expect(student?.photoUrl).toBe(published.photoUrl)
    expect(student?.photoAttachmentId).toBe(attachment.id)
  })

  test('guardian submit, withdraw, reject with reason, and approve replace the published portrait only on approval', async () => {
    const first = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-first',
    })
    await fixture.app.studentWorkflow.publishStudentPhoto({
      requestId: 'req-first-publish',
      studentId: 'stu1',
      attachmentId: first.id,
    })

    const proposed = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-proposed',
      actor: guardianService(),
    })
    const submitted = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-submit',
      studentId: 'stu1',
      attachmentId: proposed.id,
    })
    expect(submitted.status).toBe(StudentPhotoSubmissionStatus.Pending)
    expect((await fixture.schoolRepositories.students.findById('stu1'))?.photoAttachmentId).toBe(first.id)

    const replay = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-submit',
      studentId: 'stu1',
      attachmentId: proposed.id,
    })
    expect(replay.id).toBe(submitted.id)

    const withdrawn = await guardianService().studentWorkflow.withdrawStudentPhotoSubmission({
      requestId: 'req-withdraw',
      submissionId: submitted.id,
      expectedVersion: submitted.version,
    })
    expect(withdrawn.status).toBe(StudentPhotoSubmissionStatus.Withdrawn)
    expect((await fixture.schoolRepositories.students.findById('stu1'))?.photoAttachmentId).toBe(first.id)

    const second = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-second',
      actor: guardianService(),
    })
    const pending = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-submit-2',
      studentId: 'stu1',
      attachmentId: second.id,
    })
    await expect(fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-reject-empty',
      submissionId: pending.id,
      expectedVersion: pending.version,
      decision: 'reject',
    })).rejects.toMatchObject({ code: 'STUDENT_PHOTO_REJECTION_REASON_REQUIRED' })

    const rejected = await fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-reject',
      submissionId: pending.id,
      expectedVersion: pending.version,
      decision: 'reject',
      rejectionReason: 'Too dark',
    })
    expect(rejected.status).toBe(StudentPhotoSubmissionStatus.Rejected)
    expect(rejected.rejectionReason).toBe('Too dark')
    expect((await fixture.schoolRepositories.students.findById('stu1'))?.photoAttachmentId).toBe(first.id)

    const third = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-third',
      actor: guardianService(),
    })
    const replacement = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-submit-3',
      studentId: 'stu1',
      attachmentId: third.id,
    })
    const approved = await fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-approve',
      submissionId: replacement.id,
      expectedVersion: replacement.version,
      decision: 'approve',
    })
    expect(approved.status).toBe(StudentPhotoSubmissionStatus.Approved)
    const student = await fixture.schoolRepositories.students.findById('stu1')
    expect(student?.photoAttachmentId).toBe(third.id)
    expect(student?.photoUrl).toBe(`/core/files/${third.id}/content`)
  })

  test('a later pending submission supersedes the previous pending row', async () => {
    const first = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-super-1',
      actor: guardianService(),
    })
    const pending = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-super-1',
      studentId: 'stu1',
      attachmentId: first.id,
    })
    const second = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-super-2',
      actor: guardianService(),
    })
    const next = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-super-2',
      studentId: 'stu1',
      attachmentId: second.id,
    })
    expect(next.version).toBe(pending.version + 1)
    expect((await fixture.schoolRepositories.studentPhotoSubmissions.findById(pending.id))?.status)
      .toBe(StudentPhotoSubmissionStatus.Superseded)
    const stillPending = await fixture.app.baseService.entities.studentPhotoSubmissions.list({
      studentId: 'stu1',
      status: StudentPhotoSubmissionStatus.Pending,
    })
    expect(stillPending.map(row => row.id)).toEqual([next.id])
  })

  test('unlinked and disabled guardians cannot submit a child portrait', async () => {
    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'unlinked',
      schoolId: 'school',
      firstName: 'Other',
      lastName: 'Adult',
      subjectId: 'unlinked-subject',
    }))
    const unlinked = fixture.forActor(createGuardianActorMetadata({
      schoolId: 'school',
      guardianId: 'unlinked',
      subjectId: 'unlinked-subject',
      requestId: 'unlinked',
      authenticatedAt: new Date(),
    }))
    await expect(completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-unlinked',
      actor: unlinked,
    })).rejects.toBeInstanceOf(AuthorizationError)

    const ready = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-disabled',
      actor: guardianService(),
    })
    const guardian = (await fixture.schoolRepositories.guardians.findById('gua1'))!
    await fixture.schoolRepositories.guardians.save(new Guardian({
      ...guardian.data,
      hasAccess: false,
    }))
    await expect(guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-disabled',
      studentId: 'stu1',
      attachmentId: ready.id,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('teachers and co-guardians see published bytes only; pending preview is submitter or staff', async () => {
    const published = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-visible',
    })
    await fixture.app.studentWorkflow.publishStudentPhoto({
      requestId: 'req-visible',
      studentId: 'stu1',
      attachmentId: published.id,
    })
    const proposed = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-hidden',
      actor: guardianService(),
    })
    await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-hidden',
      studentId: 'stu1',
      attachmentId: proposed.id,
    })

    await fixture.schoolRepositories.guardians.save(new Guardian({
      id: 'co-gua',
      schoolId: 'school',
      firstName: 'Co',
      lastName: 'Guardian',
      subjectId: 'co-subject',
    }))
    await fixture.schoolRepositories.guardianLinks.save(new GuardianStudentLink({
      id: 'link-co',
      schoolId: 'school',
      guardianId: 'co-gua',
      studentId: 'stu1',
      relationship: 'parent',
    }))
    const coGuardian = fixture.forActor(createGuardianActorMetadata({
      schoolId: 'school',
      guardianId: 'co-gua',
      subjectId: 'co-subject',
      requestId: 'co',
      authenticatedAt: new Date(),
    }))
    await fixture.schoolRepositories.teachers.save(new Teacher({
      id: 'teacher-a',
      schoolId: 'school',
      firstName: 'Alan',
      lastName: 'Turing',
      subjectId: 'teacher-subject',
    }))
    const teacher = fixture.forActor(createTeacherActorMetadata({
      schoolId: 'school',
      teacherId: 'teacher-a',
      subjectId: 'teacher-subject',
      requestId: 'teacher',
      authenticatedAt: new Date(),
    }))

    expect(await preview(published.id, coGuardian)).toBeTruthy()
    expect(await preview(published.id, guardianService())).toBeTruthy()
    await expect(preview(proposed.id, teacher)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview(proposed.id, coGuardian)).rejects.toBeInstanceOf(AuthorizationError)
    expect(await preview(proposed.id, guardianService())).toBeTruthy()
    expect(await preview(proposed.id, fixture.app)).toBeTruthy()
  })

  test('generic attachment registration cannot complete a portrait purpose', async () => {
    await expect(fixture.app.setupWorkflow.registerAttachment({
      id: 'att-generic-portrait',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      purpose: 'student.portrait',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: jpeg.byteLength,
      storageKey: 'forged',
      status: AttachmentStatus.Ready,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('profile photo admission is JPEG under the configured cap', async () => {
    await expect(fixture.app.studentWorkflow.createProfilePhotoUpload({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'portrait.png',
      mimeType: 'image/png',
      sizeBytes: jpeg.byteLength,
    })).rejects.toMatchObject({ code: 'UPLOAD_MIME_TYPE_NOT_ALLOWED' })
    await expect(fixture.app.studentWorkflow.createProfilePhotoUpload({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1_048_577,
    })).rejects.toMatchObject({ code: 'UPLOAD_SIZE_NOT_ALLOWED' })
  })

  test('stale review versions and staff publication cannot revive superseded work', async () => {
    const first = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-stale',
      actor: guardianService(),
    })
    const pending = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-stale',
      studentId: 'stu1',
      attachmentId: first.id,
    })
    await expect(fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-stale-review',
      submissionId: pending.id,
      expectedVersion: pending.version + 1,
      decision: 'approve',
    })).rejects.toMatchObject({ code: 'STUDENT_PHOTO_VERSION_CONFLICT' })

    const replacement = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-staff-publish',
    })
    const published = await fixture.app.studentWorkflow.publishStudentPhoto({
      requestId: 'req-staff-publish',
      studentId: 'stu1',
      attachmentId: replacement.id,
    })
    expect(published.photoAttachmentId).toBe(replacement.id)
    expect((await fixture.schoolRepositories.studentPhotoSubmissions.findById(pending.id))?.status)
      .toBe(StudentPhotoSubmissionStatus.Superseded)
    await expect(fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-stale-after-publish',
      submissionId: pending.id,
      expectedVersion: pending.version,
      decision: 'approve',
    })).rejects.toMatchObject({ code: 'STUDENT_PHOTO_NOT_PENDING' })
    expect((await fixture.schoolRepositories.students.findById('stu1'))?.photoAttachmentId).toBe(replacement.id)
  })

  test('complete-upload rejects a mislabeled non-JPEG portrait', async () => {
    const png = await Bun.file(new URL('../fixtures/upload-formats/synthetic.png', import.meta.url)).bytes()
    const intent = await fixture.app.studentWorkflow.createProfilePhotoUpload({
      attachmentId: 'att-mislabeled',
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: png.byteLength,
    })
    await storage.putObject({ key: intent.storageKey, body: png, contentType: 'image/jpeg' })
    const record = (await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!
    await expect(fixture.app.studentWorkflow.completeProfilePhotoUpload({
      ...record.attachment,
      status: AttachmentStatus.Ready,
    })).rejects.toMatchObject({ code: 'ATTACHMENT_CONTENT_INVALID' })
    expect(await fixture.schoolRepositories.attachments.findById('att-mislabeled')).toBeUndefined()
  })

  test('guardian and staff self-portraits publish immediately without a submission row', async () => {
    const guardianPhoto = await completePortrait({
      ownerKind: AttachmentOwnerKind.Guardian,
      ownerId: 'gua1',
      attachmentId: 'att-gua',
      actor: guardianService(),
    })
    const guardian = await guardianService().studentWorkflow.updateGuardianProfile({
      guardianId: 'gua1',
      photoUrl: `/core/files/${guardianPhoto.id}/content`,
    })
    expect(guardian.photoUrl).toBe(`/core/files/${guardianPhoto.id}/content`)
    await expect(guardianService().studentWorkflow.updateGuardianProfile({
      guardianId: 'gua1',
      photoUrl: 'https://cdn.example/photo.jpg',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)

    const staffPhoto = await completePortrait({
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'admin',
      attachmentId: 'att-staff',
    })
    const staff = await fixture.app.setupWorkflow.updateStaffMemberProfile({
      staffId: 'admin',
      photoUrl: `/core/files/${staffPhoto.id}/content`,
    })
    expect(staff.photoUrl).toBe(`/core/files/${staffPhoto.id}/content`)
    expect(await fixture.app.baseService.entities.studentPhotoSubmissions.count({})).toBe(0)
  })

  test('teacher portraits publish immediately through teachers.save', async () => {
    await fixture.schoolRepositories.teachers.save(new Teacher({
      id: 'tea1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Teacher',
    }))
    const teacherPhoto = await completePortrait({
      ownerKind: AttachmentOwnerKind.Teacher,
      ownerId: 'tea1',
      attachmentId: 'att-teacher',
    })
    const existing = (await fixture.app.baseService.entities.teachers.findById('tea1'))!
    await fixture.app.baseService.entities.teachers.save(existing.copyWith({
      photoUrl: `/core/files/${teacherPhoto.id}/content`,
    }))
    expect((await fixture.app.baseService.entities.teachers.findById('tea1'))?.photoUrl).toBe(`/core/files/${teacherPhoto.id}/content`)
    await expect(fixture.app.baseService.entities.teachers.save(existing.copyWith({
      photoUrl: 'https://cdn.example/photo.jpg',
    }))).rejects.toBeInstanceOf(BusinessRuleViolationError)
    expect(await fixture.app.baseService.entities.studentPhotoSubmissions.count({})).toBe(0)
  })

  async function remainingProtectionMs(storageKey: string): Promise<number> {
    const { rows } = await fixture.db.query<{ remaining_ms: string }>(
      `SELECT (EXTRACT(EPOCH FROM (protected_until - clock_timestamp())) * 1000)::bigint AS remaining_ms
       FROM private_file_objects WHERE storage_key = '${storageKey.replaceAll('\'', '\'\'')}'`,
    )
    return Number(rows[0]?.remaining_ms)
  }

  async function dueStorageKeys() {
    return (await fixture.app.baseService.repositories.privateFiles.listDue('school', 50)).map(row => row.storageKey)
  }

  async function sweepPortraits(asOf: Date) {
    const cleanup = fixture.forActor(createSystemActorMetadata({
      schoolId: 'school',
      systemId: 'preparePrivateFileCleanup',
      requestId: 'portrait-cleanup',
      reason: 'test',
    }))
    return fixture.atomicExecution.execute(() => sweepExpiredStudentPortraitAttachments(cleanup.baseService, asOf))
  }

  test('student portrait cleanup uses 24h abandoned and 30d terminal windows and never sweeps pending or published bytes', async () => {
    const abandoned = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-abandon',
    })
    const abandonedKey = abandoned.storageKey!
    expect(await remainingProtectionMs(abandonedKey)).toBeGreaterThan(STUDENT_PHOTO_ABANDONED_MS - 15_000)
    expect(await remainingProtectionMs(abandonedKey)).toBeLessThanOrEqual(STUDENT_PHOTO_ABANDONED_MS + 5_000)
    const cleanupSchools = (at: Date) => fixture.schoolRepositories.cronJobSchedules.listDueSchoolIds('preparePrivateFileCleanup', at)
    expect(await cleanupSchools(new Date())).toEqual([])
    expect(await cleanupSchools(new Date(Date.now() + STUDENT_PHOTO_ABANDONED_MS + 1000))).toEqual(['school'])
    expect(await sweepPortraits(new Date())).toMatchObject({ processed: 0 })
    expect(await fixture.schoolRepositories.attachments.findById(abandoned.id)).toBeDefined()

    expect(await sweepPortraits(new Date(Date.now() + STUDENT_PHOTO_ABANDONED_MS + 1_000))).toMatchObject({ processed: 1 })
    expect(await fixture.schoolRepositories.attachments.findById(abandoned.id)).toBeUndefined()
    await fixture.db.exec(`UPDATE private_file_objects SET protected_until = '2000-01-01' WHERE storage_key = '${abandonedKey.replaceAll('\'', '\'\'')}'`)
    expect(await dueStorageKeys()).toContain(abandonedKey)

    const pendingAttachment = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-pending-retain',
      actor: guardianService(),
    })
    const pending = await guardianService().studentWorkflow.submitStudentPhoto({
      requestId: 'req-pending-retain',
      studentId: 'stu1',
      attachmentId: pendingAttachment.id,
    })
    expect(await sweepPortraits(new Date(Date.now() + STUDENT_PHOTO_TERMINAL_RETAIN_MS + 1_000))).toMatchObject({ processed: 0 })
    expect(await fixture.schoolRepositories.attachments.findById(pendingAttachment.id)).toBeDefined()
    await fixture.db.exec(`UPDATE private_file_objects SET protected_until = '2000-01-01' WHERE storage_key = '${pendingAttachment.storageKey!.replaceAll('\'', '\'\'')}'`)
    expect(await dueStorageKeys()).not.toContain(pendingAttachment.storageKey!)

    const rejected = await fixture.app.studentWorkflow.reviewStudentPhoto({
      requestId: 'req-reject-retain',
      submissionId: pending.id,
      expectedVersion: pending.version,
      decision: 'reject',
      rejectionReason: 'Blurry',
    })
    expect(rejected.status).toBe(StudentPhotoSubmissionStatus.Rejected)
    expect(await fixture.schoolRepositories.attachments.findById(pendingAttachment.id)).toBeUndefined()
    expect(await remainingProtectionMs(pendingAttachment.storageKey!)).toBeGreaterThan(STUDENT_PHOTO_TERMINAL_RETAIN_MS - 15_000)
    expect(await remainingProtectionMs(pendingAttachment.storageKey!)).toBeLessThanOrEqual(STUDENT_PHOTO_TERMINAL_RETAIN_MS + 5_000)
    expect(await fixture.schoolRepositories.studentPhotoSubmissions.findById(rejected.id)).toBeDefined()
    await fixture.db.exec(`UPDATE private_file_objects SET protected_until = '2000-01-01' WHERE storage_key = '${pendingAttachment.storageKey!.replaceAll('\'', '\'\'')}'`)
    expect(await dueStorageKeys()).toContain(pendingAttachment.storageKey!)

    const publishedAttachment = await completePortrait({
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'stu1',
      attachmentId: 'att-published-retain',
    })
    await fixture.app.studentWorkflow.publishStudentPhoto({
      requestId: 'req-published-retain',
      studentId: 'stu1',
      attachmentId: publishedAttachment.id,
    })
    expect(await sweepPortraits(new Date(Date.now() + STUDENT_PHOTO_TERMINAL_RETAIN_MS + 1_000))).toMatchObject({ processed: 0 })
    expect(await fixture.schoolRepositories.attachments.findById(publishedAttachment.id)).toBeDefined()
    await fixture.db.exec(`UPDATE private_file_objects SET protected_until = '2000-01-01' WHERE storage_key = '${publishedAttachment.storageKey!.replaceAll('\'', '\'\'')}'`)
    expect(await dueStorageKeys()).not.toContain(publishedAttachment.storageKey!)
    expect((await fixture.schoolRepositories.students.findById('stu1'))?.photoAttachmentId).toBe(publishedAttachment.id)
  })
})
