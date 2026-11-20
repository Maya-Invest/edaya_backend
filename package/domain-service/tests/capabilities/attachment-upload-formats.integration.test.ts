import { AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage } from '@edaya/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { completeAttachmentUpload, createAttachmentUpload } from '../../src/capabilities/files/attachment-uploads'
import { createTestApp } from '../support/create-test-app'

const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const accepted = [
  ['synthetic.jpg', 'image/jpeg'],
  ['synthetic.png', 'image/png'],
  ['synthetic.apng', 'image/png'],
  ['synthetic.apng', 'image/apng'],
  ['synthetic.webp', 'image/webp'],
  ['synthetic.gif', 'image/gif'],
  ['synthetic.pdf', 'application/pdf'],
  ['synthetic.docx', docxMime],
] as const

function fileBytes(name: string) {
  return Bun.file(new URL(`../fixtures/upload-formats/${name}`, import.meta.url)).bytes()
}

describe('attachment upload content format qualification', () => {
  const storage = createInMemoryFileStorage()
  let fixture: Awaited<ReturnType<typeof createTestApp>>
  beforeEach(async () => {
    fixture = await createTestApp(undefined, { fileStorage: storage })
  })

  async function admit(body: Uint8Array, mimeType: string) {
    const result = await createAttachmentUpload(fixture.app.baseService, {
      attachmentId: crypto.randomUUID(),
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'admin',
      // The name intentionally gives the detector no information about the bytes.
      fileName: 'upload.bin',
      mimeType,
      sizeBytes: body.byteLength,
    })
    await storage.putObject({ key: result.storageKey, body, contentType: mimeType })
    return (await fixture.schoolRepositories.attachmentUploads.find('school', result.attachmentId))!
  }

  for (const [name, mimeType] of accepted) {
    test(`publishes actual ${name} bytes admitted as ${mimeType}`, async () => {
      const body = await fileBytes(name)
      const intent = await admit(body, mimeType)
      const result = await completeAttachmentUpload(fixture.app.baseService, { ...intent.attachment, status: AttachmentStatus.Ready })
      expect(result.status).toBe(AttachmentStatus.Ready)
      expect(result.mimeType).toBe(mimeType)
      expect(result.storageKey).not.toBe(intent.attachment.storageKey)
      expect((await storage.readObject(result.storageKey!, { maxBytes: body.byteLength }))!.body).toEqual(body)
    })
  }

  for (const [name, mimeType] of [
    ['synthetic.jpg', 'image/png'],
    ['synthetic.png', 'image/apng'],
    ['synthetic.pdf', docxMime],
    ['unrelated.zip', docxMime],
  ]) {
    test(`rejects ${name} falsely declared as ${mimeType}`, async () => {
      const intent = await admit(await fileBytes(name!), mimeType!)
      await expect(completeAttachmentUpload(fixture.app.baseService, { ...intent.attachment, status: AttachmentStatus.Ready })).rejects.toMatchObject({ code: 'ATTACHMENT_CONTENT_INVALID' })
      expect(await fixture.schoolRepositories.attachments.findById(intent.attachmentId)).toBeUndefined()
      expect((await fixture.schoolRepositories.attachmentUploads.find('school', intent.attachmentId))!.completedStorageKey).toBeUndefined()
    })
  }

  test('rejects unidentifiable, truncated and ambiguous compound data without publishing', async () => {
    for (const body of [
      new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
      (await fileBytes('synthetic.png')).slice(0, 12),
      Uint8Array.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...Array.from({ length: 504 }).fill(0)]),
    ]) {
      const intent = await admit(body, 'image/png')
      await expect(completeAttachmentUpload(fixture.app.baseService, { ...intent.attachment, status: AttachmentStatus.Ready })).rejects.toMatchObject({ code: 'ATTACHMENT_CONTENT_INVALID' })
      expect(await fixture.schoolRepositories.attachments.findById(intent.attachmentId)).toBeUndefined()
    }
  })

  test('rejects unsupported legacy DOC before storing an upload intent', async () => {
    const attachmentId = crypto.randomUUID()
    await expect(createAttachmentUpload(fixture.app.baseService, {
      attachmentId,
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'admin',
      fileName: 'legacy.doc',
      mimeType: 'application/msword',
      sizeBytes: 512,
    })).rejects.toMatchObject({ code: 'UPLOAD_MIME_TYPE_NOT_ALLOWED' })
    expect(await fixture.schoolRepositories.attachmentUploads.find('school', attachmentId)).toBeUndefined()
  })
})
