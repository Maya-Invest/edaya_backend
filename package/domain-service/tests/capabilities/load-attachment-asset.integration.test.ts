import type { AttachmentAssetRequest } from '../../src/capabilities/files/load-attachment-asset'
import { Attachment, AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage, School, StaffMember } from '@edaya/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { grantAttachmentDownload } from '../../src/capabilities/files/grant-attachment-download'
import { loadAttachmentAsset } from '../../src/capabilities/files/load-attachment-asset'
import { createTestApp } from '../support/create-test-app'

describe('authorized private attachment assets', () => {
  let fixture: Awaited<ReturnType<typeof createTestApp>>
  let attachment: Attachment
  let reads: number
  let duringRead: (() => Promise<void>) | undefined
  let storage: ReturnType<typeof createInMemoryFileStorage>
  const request: AttachmentAssetRequest = {
    attachmentId: 'asset',
    ownerKind: AttachmentOwnerKind.Staff,
    ownerId: 'admin',
    maxBytes: 3,
    allowedMimeTypes: ['image/png'],
  }

  beforeEach(async () => {
    reads = 0
    duringRead = undefined
    storage = createInMemoryFileStorage()
    fixture = await createTestApp(undefined, { fileStorage: {
      ...storage,
      async readObject(key, options) {
        reads++
        const result = await storage.readObject(key, options)
        await duringRead?.()
        return result
      },
    } })
    attachment = new Attachment({
      id: 'asset',
      schoolId: 'school',
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'admin',
      fileName: 'asset.png',
      storageKey: 'school/private/asset',
      status: AttachmentStatus.Ready,
      mimeType: 'image/png',
      sizeBytes: 3,
    })
    await fixture.schoolRepositories.attachments.save(attachment)
    await storage.putObject({ key: attachment.storageKey!, body: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
  })

  test('loads only the stored private key with an explicit matching owner, MIME and byte bound', async () => {
    await expect(loadAttachmentAsset(fixture.app.baseService, request)).resolves.toMatchObject({ body: new Uint8Array([1, 2, 3]), sizeBytes: 3 })
    expect(reads).toBe(1)
    for (const override of [
      { ownerId: 'unrelated' },
      { ownerKind: AttachmentOwnerKind.Student },
      { allowedMimeTypes: ['application/pdf'] },
      { maxBytes: 2 },
    ]) {
      await expect(loadAttachmentAsset(fixture.app.baseService, { ...request, ...override })).rejects.toThrow()
    }
    expect(reads).toBe(1)
  })

  test('conceals missing and foreign-school attachment IDs before reading storage', async () => {
    await fixture.schoolRepositories.schools.save(new School({ id: 'other-school', name: 'Other', timeZone: 'UTC' }))
    await fixture.schoolRepositories.staffMembers.save(new StaffMember({ id: 'other-staff', schoolId: 'other-school', firstName: 'Other', lastName: 'Staff' }))
    await fixture.schoolRepositories.attachments.save(new Attachment({ ...attachment.data, id: 'foreign', schoolId: 'other-school', ownerId: 'other-staff', storageKey: 'other-school/private/foreign.png' }))
    for (const attachmentId of ['missing', 'foreign'])
      await expect(loadAttachmentAsset(fixture.app.baseService, { ...request, attachmentId })).rejects.toThrow()
    expect(reads).toBe(0)
  })

  test('does not fetch legacy URLs or pending uploads', async () => {
    for (const changes of [{ storageKey: undefined, fileUrl: 'https://private.invalid/secret' }, { status: AttachmentStatus.PendingUpload }]) {
      await fixture.schoolRepositories.attachments.save(new Attachment({ ...attachment.data, ...changes }))
      await expect(loadAttachmentAsset(fixture.app.baseService, request)).rejects.toThrow('A ready private attachment is required')
    }
    expect(reads).toBe(0)
  })

  test('withholds read bytes when current access is revoked during storage I/O', async () => {
    duringRead = async () => {
      const school = (await fixture.schoolRepositories.schools.findById('school'))!
      await fixture.schoolRepositories.schools.save(new School({ ...school.data, ownerSubjectId: 'different-owner' }))
    }
    await expect(loadAttachmentAsset(fixture.app.baseService, request)).rejects.toThrow()
    expect(reads).toBe(1)
  })

  test('rejects a changed record after reading and checks actual object metadata', async () => {
    duringRead = async () => {
      await fixture.schoolRepositories.attachments.save(new Attachment({ ...attachment.data, storageKey: 'school/private/replaced' }))
    }
    await expect(loadAttachmentAsset(fixture.app.baseService, request)).rejects.toThrow('Attachment changed during asset loading')
    duringRead = undefined
    await fixture.schoolRepositories.attachments.save(attachment)
    await storage.putObject({ key: attachment.storageKey!, body: new Uint8Array([1, 2]), contentType: 'image/png' })
    await expect(loadAttachmentAsset(fixture.app.baseService, request)).rejects.toThrow('Attachment object size does not match its record')
    await storage.putObject({ key: attachment.storageKey!, body: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' })
    await expect(loadAttachmentAsset(fixture.app.baseService, request)).rejects.toThrow('Attachment object type does not match its record')
  })

  test('grants a bounded private download only after a scoped read and current reauthorization', async () => {
    let signs = 0
    fixture.app.baseService.fileStorage.createPresignedDownload = async (key, options) => {
      signs++
      expect(key).toBe(attachment.storageKey!)
      expect(options).toEqual({ fileName: 'asset.png', expiresInSeconds: 900, disposition: 'inline' })
      return { downloadUrl: 'https://private.invalid/?signed=credential', expiresAt: new Date(Date.now() + 900000) }
    }
    expect(await grantAttachmentDownload(fixture.app.baseService, 'missing')).toBeNull()
    expect(signs).toBe(0)
    expect(await grantAttachmentDownload(fixture.app.baseService, attachment.id, { inlineImages: true })).toMatchObject({ downloadUrl: 'https://private.invalid/?signed=credential' })
    fixture.app.baseService.fileStorage.createPresignedDownload = async () => {
      const school = (await fixture.schoolRepositories.schools.findById('school'))!
      await fixture.schoolRepositories.schools.save(new School({ ...school.data, ownerSubjectId: 'different-owner' }))
      return { downloadUrl: 'https://private.invalid/?signed=credential', expiresAt: new Date() }
    }
    await expect(grantAttachmentDownload(fixture.app.baseService, attachment.id)).rejects.toThrow()
  })

  test('preserves legacy external metadata without signing or issuing an unbounded download', async () => {
    const legacy = new Attachment({ ...attachment.data, storageKey: undefined, fileUrl: 'https://external.invalid/?credential=legacy' })
    await fixture.schoolRepositories.attachments.save(legacy)
    let signs = 0
    fixture.app.baseService.fileStorage.createPresignedDownload = async () => {
      signs++
      throw new Error('Legacy external links must not reach storage signing')
    }
    expect(await grantAttachmentDownload(fixture.app.baseService, legacy.id)).toBeNull()
    expect(signs).toBe(0)
    expect((await fixture.schoolRepositories.attachments.findById(legacy.id))?.data).toEqual(legacy.data)
  })

  test('rejects changed download records and sanitizes provider failures', async () => {
    fixture.app.baseService.fileStorage.createPresignedDownload = async () => {
      await fixture.schoolRepositories.attachments.save(new Attachment({ ...attachment.data, status: AttachmentStatus.Failed }))
      return { downloadUrl: 'https://private.invalid/?signed=credential', expiresAt: new Date() }
    }
    await expect(grantAttachmentDownload(fixture.app.baseService, attachment.id)).rejects.toMatchObject({ code: 'ATTACHMENT_CHANGED' })
    await fixture.schoolRepositories.attachments.save(attachment)
    fixture.app.baseService.fileStorage.createPresignedDownload = async () => {
      throw new Error('Provider leaked https://private.invalid/?signed=credential')
    }
    await expect(grantAttachmentDownload(fixture.app.baseService, attachment.id)).rejects.toThrow('ATTACHMENT_STORAGE_UNAVAILABLE')
  })
})
