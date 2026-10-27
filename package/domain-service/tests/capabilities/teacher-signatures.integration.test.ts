/* eslint-disable dot-notation -- Snapshot payload fixtures require bracket access. */
import { Buffer } from 'node:buffer'
import { AuthorizationError, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicYear, AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage, DocumentIssuanceStatus, Incident, IncidentKind, Teacher, TEACHER_SIGNATURE_MAX_BYTES, TEACHER_SIGNATURE_PURPOSE } from '@edaya/core'
import { dispatchDocumentRender, freezeDocumentTeachers, grantAttachmentDownload, resolveAttachmentReadPolicy } from '@edaya/service'
import { beforeEach, describe, expect, test } from 'bun:test'
import { PNG } from 'pngjs'
import { teacherSignatureDocumentPng } from '../../src/capabilities/files/teacher-signature-image'
import { createTestApp } from '../support/create-test-app'

const png = await Bun.file(new URL('../fixtures/upload-formats/synthetic.png', import.meta.url)).bytes()

describe('teacher signatures', () => {
  let fixture: Awaited<ReturnType<typeof createTestApp>>
  let storage: ReturnType<typeof createInMemoryFileStorage>
  const rendered: Array<Record<string, unknown>> = []

  function teacher(id = 'teacher-a', schoolId = 'school') {
    return fixture.forActor(createTeacherActorMetadata({ schoolId, teacherId: id, subjectId: `${id}-subject`, requestId: 'signature-request', authenticatedAt: new Date() }))
  }

  beforeEach(async () => {
    rendered.length = 0
    storage = createInMemoryFileStorage()
    fixture = await createTestApp(undefined, { fileStorage: storage, documentRenderer: { render: async (input) => {
      rendered.push(input.payload as Record<string, unknown>)
      return { bytes: new TextEncoder().encode('%PDF-1.4 signature-test'), contentType: 'application/pdf', sha256: 'a'.repeat(64), renderId: crypto.randomUUID() }
    } } })
    for (const id of ['teacher-a', 'teacher-b']) {
      await fixture.schoolRepositories.teachers.save(new Teacher({ id, schoolId: 'school', firstName: 'Ada', lastName: 'Teacher', subjectId: `${id}-subject` }))
    }
    await fixture.schoolRepositories.academicYears.save(new AcademicYear({ id: 'year', schoolId: 'school', name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), status: 'published' }))
  })

  async function upload(id: string, actor = teacher()) {
    const intent = await actor.documentsWorkflow.createTeacherSignatureUpload({ attachmentId: id, fileName: 'signature.png', mimeType: 'image/png', sizeBytes: png.byteLength })
    await storage.putObject({ key: intent.storageKey, body: png, contentType: 'image/png' })
    const result = await actor.documentsWorkflow.completeTeacherSignatureUpload({ attachmentId: intent.attachmentId })
    return { intent, result }
  }

  async function preview(id: string, actor = teacher()) {
    const access = await resolveAttachmentReadPolicy(actor.baseService, id)
    return grantAttachmentDownload(actor.baseService, id, { access })
  }

  test('self-only PNG upload derives ownership, persists the teacher slot, and previews privately', async () => {
    const { result } = await upload('signature-1')
    expect(result.signatureAttachmentId).toBe('signature-1')
    const stored = await fixture.schoolRepositories.attachments.findById('signature-1')
    expect(stored?.ownerKind).toBe(AttachmentOwnerKind.Teacher)
    expect(stored?.ownerId).toBe('teacher-a')
    expect(stored?.purpose).toBe(TEACHER_SIGNATURE_PURPOSE)
    expect(stored?.status).toBe(AttachmentStatus.Ready)
    expect(await preview('signature-1')).toBeTruthy()
    await expect(preview('signature-1', teacher('teacher-b'))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview('signature-1', fixture.app)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(preview('signature-1', teacher('teacher-a', 'other-school'))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(fixture.app.documentsWorkflow.createTeacherSignatureUpload({ fileName: 'signature.png', mimeType: 'image/png', sizeBytes: png.byteLength })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('replacement and clear are replay-safe and current signatures are retained', async () => {
    const actor = teacher()
    await upload('signature-1', actor)
    await upload('signature-2', actor)
    expect((await actor.documentsWorkflow.completeTeacherSignatureUpload({ attachmentId: 'signature-1' })).signatureAttachmentId).toBe('signature-2')
    await expect(fixture.atomicExecution.execute(() => fixture.schoolRepositories.privateFiles.assertRemovable('school', 'signature-2'))).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
    await expect(actor.documentsWorkflow.clearTeacherSignature({ requestId: 'stale-clear', attachmentId: 'signature-1' })).rejects.toThrow('Reload')
    expect((await actor.documentsWorkflow.clearTeacherSignature({ requestId: 'clear-2', attachmentId: 'signature-2' })).signatureAttachmentId).toBeUndefined()
    await upload('signature-3', actor)
    expect((await actor.documentsWorkflow.clearTeacherSignature({ requestId: 'clear-2', attachmentId: 'signature-2' })).signatureAttachmentId).toBe('signature-3')
  })

  test('invalid contents, oversize images, and cross-owner completion preserve the current signature', async () => {
    const actor = teacher()
    await upload('valid')
    await expect(actor.documentsWorkflow.createTeacherSignatureUpload({ fileName: 'signature.png', mimeType: 'image/png', sizeBytes: TEACHER_SIGNATURE_MAX_BYTES + 1 })).rejects.toThrow()
    await expect(actor.documentsWorkflow.createTeacherSignatureUpload({ fileName: 'signature.jpg', mimeType: 'image/jpeg', sizeBytes: 10 })).rejects.toThrow()
    const intent = await actor.documentsWorkflow.createTeacherSignatureUpload({ attachmentId: 'bad', fileName: 'signature.png', mimeType: 'image/png', sizeBytes: 8 })
    await storage.putObject({ key: intent.storageKey, body: new TextEncoder().encode('notimage'), contentType: 'image/png' })
    await expect(actor.documentsWorkflow.completeTeacherSignatureUpload({ attachmentId: 'bad' })).rejects.toThrow()
    await expect(teacher('teacher-b').documentsWorkflow.completeTeacherSignatureUpload({ attachmentId: 'valid' })).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.schoolRepositories.teachers.findById('teacher-a'))?.signatureAttachmentId).toBe('valid')
  })

  test('a corrupt PNG container cannot replace an existing signature', async () => {
    await upload('valid')
    const broken = new Uint8Array(png)
    broken[broken.length - 5] = broken[broken.length - 5]! ^ 255
    const intent = await teacher().documentsWorkflow.createTeacherSignatureUpload({ attachmentId: 'corrupt', fileName: 'signature.png', mimeType: 'image/png', sizeBytes: broken.length })
    await storage.putObject({ key: intent.storageKey, body: broken, contentType: 'image/png' })
    await expect(teacher().documentsWorkflow.completeTeacherSignatureUpload({ attachmentId: 'corrupt' })).rejects.toMatchObject({ code: 'ATTACHMENT_CONTENT_INVALID' })
    expect((await fixture.schoolRepositories.teachers.findById('teacher-a'))?.signatureAttachmentId).toBe('valid')
  })

  test('missing captured assets fail recoverably and retry uses the original reference', async () => {
    await upload('captured')
    await fixture.schoolRepositories.incidents.save(new Incident({ id: 'incident', schoolId: 'school', title: 'Event', description: 'Event details', date: new Date(), kind: IncidentKind.Positive, reporterId: 'teacher-a' }))
    const issued = await fixture.app.documentsWorkflow.requestDocumentIssuance({ requestId: 'missing-asset', templateKey: 'incident-report.v1', sourceId: 'incident', academicYearId: 'year' })
    const key = (await fixture.schoolRepositories.attachments.findById('captured'))!.storageKey!
    await storage.deleteObject(key)
    await dispatchDocumentRender(fixture.application)
    expect((await fixture.schoolRepositories.documentIssuances.findById(issued.id))?.failureCode).toBe('TEACHER_SIGNATURE_ASSET_UNAVAILABLE')
    expect(rendered).toHaveLength(0)
    await upload('new-signature')
    await storage.putObject({ key, body: png, contentType: 'image/png' })
    await fixture.app.documentsWorkflow.retryDocumentIssuance({ requestId: 'restore-asset', issuanceId: issued.id })
    await dispatchDocumentRender(fixture.application)
    expect((await fixture.schoolRepositories.documentIssuances.findById(issued.id))?.status).toBe(DocumentIssuanceStatus.Ready)
    expect((await fixture.schoolRepositories.documentIssuances.findById(issued.id))?.snapshot.teacherSignatures).toEqual([{ teacherId: 'teacher-a', attachmentId: 'captured' }])
  })

  test('staff and unresolved incident authors receive no teacher signature', async () => {
    await upload('valid')
    for (const reporterId of ['staff-test', 'missing']) {
      await fixture.schoolRepositories.incidents.save(new Incident({ id: reporterId, schoolId: 'school', title: 'Event', description: 'Event details', date: new Date(), kind: IncidentKind.Positive, reporterId }))
      const issued = await fixture.app.documentsWorkflow.requestDocumentIssuance({ requestId: reporterId, templateKey: 'incident-report.v1', sourceId: reporterId, academicYearId: 'year' })
      const snapshot = (await fixture.schoolRepositories.documentIssuances.findById(issued.id))!.snapshot
      expect(snapshot.teacherSignatures).toEqual([])
      expect(snapshot.facts?.['reporterTeachers']).toBeUndefined()
    }
  })

  test('generic teacher and file mutations cannot change signature ownership or slot', async () => {
    await upload('valid')
    const current = (await fixture.schoolRepositories.teachers.findById('teacher-a'))!
    await expect(fixture.app.baseService.entities.teachers.save(current.copyWith({ signatureAttachmentId: undefined }))).rejects.toThrow('signature commands')
    await expect(teacher().baseService.entities.teachers.save(current.copyWith({ signatureAttachmentId: undefined }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(fixture.app.setupWorkflow.registerAttachment({ id: 'fake', schoolId: 'school', ownerKind: AttachmentOwnerKind.Teacher, ownerId: 'teacher-a', purpose: TEACHER_SIGNATURE_PURPOSE, fileName: 'signature.png', storageKey: 'fake', mimeType: 'image/png', sizeBytes: 10 })).rejects.toThrow()
  })

  test('pending incident rendering retains the captured signature through replacement, clear, and retries', async () => {
    const actor = teacher()
    await upload('captured', actor)
    await fixture.schoolRepositories.incidents.save(new Incident({ id: 'incident', schoolId: 'school', title: 'Positive event', description: 'Helped another student', date: new Date(), kind: IncidentKind.Positive, reporterId: 'teacher-a' }))
    const issuance = await fixture.app.documentsWorkflow.requestDocumentIssuance({ requestId: 'incident-pdf', templateKey: 'incident-report.v1', sourceId: 'incident', academicYearId: 'year' })
    const snapshot = (await fixture.schoolRepositories.documentIssuances.findById(issuance.id))!.snapshot
    expect(snapshot.teacherSignatures).toEqual([{ teacherId: 'teacher-a', attachmentId: 'captured' }])
    await upload('replacement', actor)
    await actor.documentsWorkflow.clearTeacherSignature({ requestId: 'clear-replacement', attachmentId: 'replacement' })
    await expect(fixture.atomicExecution.execute(() => fixture.schoolRepositories.privateFiles.assertRemovable('school', 'captured'))).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
    await dispatchDocumentRender(fixture.application)
    expect(rendered).toHaveLength(1)
    expect(rendered[0]?.['reporterTeachers']).toEqual([{ teacherId: 'teacher-a', name: 'Ada Teacher', signatureUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }])
    await dispatchDocumentRender(fixture.application)
    expect(rendered).toHaveLength(1)
    await fixture.app.documentsWorkflow.requestDocumentIssuance({ requestId: 'incident-after-clear', templateKey: 'incident-report.v1', sourceId: 'incident', academicYearId: 'year' })
    await dispatchDocumentRender(fixture.application)
    expect(rendered[1]?.['reporterTeachers']).toEqual([{ teacherId: 'teacher-a', name: 'Ada Teacher' }])
  })

  test('captured absence never acquires a signature from a later upload; duplicate names keep their identity', () => {
    const signers = [{ teacherId: 'a', name: 'Same Name', signatureAttachmentId: 'later' }, { teacherId: 'b', name: 'Same Name', signatureAttachmentId: 'other' }]
    expect(freezeDocumentTeachers(signers, [])).toEqual([{ teacherId: 'a', name: 'Same Name' }, { teacherId: 'b', name: 'Same Name' }])
    expect(freezeDocumentTeachers(signers, [{ teacherId: 'b', attachmentId: 'original' }])).toEqual([{ teacherId: 'a', name: 'Same Name' }, { teacherId: 'b', name: 'Same Name', signatureAttachmentId: 'original' }])
  })
})

test('report images preserve proportions and alpha while bounding repeated inline assets', () => {
  const source = new PNG({ width: 512, height: 384 })
  for (let y = 20; y < 364; y++) {
    for (let x = 20; x < 492; x++) {
      const offset = (y * source.width + x) * 4
      source.data[offset] = (x * 71 + y * 37) % 256
      source.data[offset + 1] = (x * 43 + y * 83) % 256
      source.data[offset + 2] = (x * 137 + y * 97) % 256
      source.data[offset + 3] = 255
    }
  }
  const stored = PNG.sync.write(source)
  const original = Buffer.from(stored)
  const inline = teacherSignatureDocumentPng(stored)
  const rendered = PNG.sync.read(Buffer.from(inline))
  expect(stored.byteLength).toBeLessThanOrEqual(TEACHER_SIGNATURE_MAX_BYTES)
  expect(rendered.width).toBeLessThanOrEqual(304)
  expect(rendered.height).toBe(112)
  expect(Math.abs(rendered.width / rendered.height - source.width / source.height)).toBeLessThan(0.01)
  expect(rendered.data[3]).toBe(0)
  expect(rendered.data[(56 * rendered.width + 60) * 4 + 3]).toBe(255)
  expect(inline.byteLength).toBeLessThan(170_000)
  expect(stored).toEqual(original)
})
