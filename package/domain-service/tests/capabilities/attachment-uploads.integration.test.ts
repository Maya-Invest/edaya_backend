import { createStaffActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage, School, StaffMember } from '@edaya/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { completeAttachmentUpload, createAttachmentUpload } from '../../src/capabilities/files/attachment-uploads'
import { createTestApp } from '../support/create-test-app'

describe('persisted attachment upload admission', () => {
  let fixture: Awaited<ReturnType<typeof createTestApp>>
  let storage: ReturnType<typeof createInMemoryFileStorage>
  const bytes = new TextEncoder().encode('%PDF-1.7\nSynthetic\n%%EOF')
  const input = { attachmentId: 'upload-test', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'admin', fileName: 'fixture.pdf', mimeType: 'application/pdf', sizeBytes: bytes.byteLength }
  beforeEach(async () => {
    storage = createInMemoryFileStorage()
    fixture = await createTestApp(undefined, { fileStorage: storage })
  })

  test('reissues only the same caller and metadata, without extending expiry', async () => {
    const first = await createAttachmentUpload(fixture.app.baseService, input)
    const original = (await fixture.schoolRepositories.attachmentUploads.find('school', input.attachmentId))!
    const second = await createAttachmentUpload(fixture.app.baseService, input)
    expect(first.storageKey).toBe(second.storageKey)
    expect((await fixture.schoolRepositories.attachmentUploads.find('school', input.attachmentId))!.expiresAt).toEqual(original.expiresAt)
    await expect(createAttachmentUpload(fixture.app.baseService, { ...input, ownerId: 'another' })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_CONFLICT' })
    const other = createStaffActorMetadata({ schoolId: 'school', staffMemberId: 'other', subjectId: 'other-subject', requestId: 'other', authenticatedAt: new Date() })
    await fixture.schoolRepositories.staffMembers.save(new StaffMember({ id: 'other', schoolId: 'school', subjectId: 'other-subject', firstName: 'Other', lastName: 'Staff' }))
    await expect(createAttachmentUpload(fixture.forActor(other).baseService, input)).rejects.toThrow()
    expect(await fixture.schoolRepositories.attachmentUploads.find('foreign-school', input.attachmentId)).toBeUndefined()
  })

  test('rejects expiry, ownership substitution and generic writes', async () => {
    const intent = await createAttachmentUpload(fixture.app.baseService, input)
    const record = (await fixture.schoolRepositories.attachmentUploads.find('school', input.attachmentId))!
    await fixture.atomicExecution.execute(() => fixture.schoolRepositories.attachmentUploads.create({
      ...record,
      attachmentId: 'expired',
      attachment: { ...record.attachment, id: 'expired', storageKey: 'expired-staging-key' },
      expiresAt: new Date(0),
    }))
    await expect(createAttachmentUpload(fixture.app.baseService, { ...input, attachmentId: 'expired' })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_EXPIRED' })
    await expect(completeAttachmentUpload(fixture.app.baseService, { ...record.attachment, ownerId: 'other-owner', status: AttachmentStatus.Ready })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_CONFLICT' })
    await expect(fixture.app.baseService.entities.attachments.save(new Attachment({ ...record.attachment, status: AttachmentStatus.Ready }))).rejects.toMatchObject({ code: 'ATTACHMENT_COMMAND_REQUIRED' })
    expect(await fixture.schoolRepositories.attachments.findById(intent.attachmentId)).toBeUndefined()
  })

  test('rejects noncanonical metadata before persisting an intent and conceals storage failures', async () => {
    for (const fields of [{ attachmentId: ' padded ' }, { ownerId: ' admin' }, { fileName: '  ' }, { mimeType: 'application/pdf ' }]) {
      await expect(createAttachmentUpload(fixture.app.baseService, { ...input, ...fields })).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_METADATA_INVALID' })
    }
    expect(await fixture.schoolRepositories.attachmentUploads.find('school', input.attachmentId)).toBeUndefined()
    fixture.app.baseService.fileStorage.createPresignedUpload = async () => {
      throw new Error('Provider failed at https://private.invalid/?credential=secret')
    }
    await expect(createAttachmentUpload(fixture.app.baseService, input)).rejects.toThrow('ATTACHMENT_STORAGE_UNAVAILABLE')
    const intent = (await fixture.schoolRepositories.attachmentUploads.find('school', input.attachmentId))!
    fixture.app.baseService.fileStorage.readObject = async () => {
      throw new Error('private body or provider credential')
    }
    await expect(completeAttachmentUpload(fixture.app.baseService, { ...intent.attachment, status: AttachmentStatus.Ready })).rejects.toThrow('ATTACHMENT_STORAGE_UNAVAILABLE')
  })

  test('rejects colliding identities across schools without returning database details', async () => {
    const intent = await createAttachmentUpload(fixture.app.baseService, input)
    const original = (await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!
    await fixture.schoolRepositories.schools.save(new School({ id: 'another-school', name: 'Other school', timeZone: 'UTC' }))
    await expect(fixture.atomicExecution.execute(() => fixture.schoolRepositories.attachmentUploads.create({
      ...original,
      schoolId: 'another-school',
      attachment: { ...original.attachment, schoolId: 'another-school', storageKey: 'other-private-key' },
    }))).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_CONFLICT', message: 'Attachment identity is unavailable' })
    expect(await fixture.schoolRepositories.attachmentUploads.find('another-school', intent.attachmentId)).toBeUndefined()
    expect((await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!.attachment.storageKey).toBe(intent.storageKey)
  })

  test('reauthorizes after storage I/O and ignores claimed uploader and creation time', async () => {
    const intent = await createAttachmentUpload(fixture.app.baseService, input)
    await storage.putObject({ key: intent.storageKey, body: bytes, contentType: input.mimeType })
    const originalPut = fixture.app.baseService.fileStorage.putObject
    fixture.app.baseService.fileStorage.putObject = async (value) => {
      const result = await originalPut(value)
      const school = (await fixture.schoolRepositories.schools.findById('school'))!
      await fixture.schoolRepositories.schools.save(new School({ ...school.data, ownerSubjectId: 'revoked-owner' }))
      return result
    }
    const completion = { ...input, id: intent.attachmentId, schoolId: 'school', storageKey: intent.storageKey, uploadedById: 'forged-uploader', createdAt: new Date(0) }
    await expect(completeAttachmentUpload(fixture.app.baseService, completion)).rejects.toThrow()
    expect(await fixture.schoolRepositories.attachments.findById(intent.attachmentId)).toBeUndefined()
    fixture.app.baseService.fileStorage.putObject = originalPut
    const school = (await fixture.schoolRepositories.schools.findById('school'))!
    await fixture.schoolRepositories.schools.save(new School({ ...school.data, ownerSubjectId: 'admin-user' }))
    const attachment = await completeAttachmentUpload(fixture.app.baseService, completion)
    expect(attachment.uploadedById).toBe('admin')
    expect(attachment.createdAt.getTime()).toBeGreaterThan(0)
  })
})
