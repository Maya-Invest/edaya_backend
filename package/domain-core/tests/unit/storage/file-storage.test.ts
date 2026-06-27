import { describe, expect, it } from 'bun:test'
import { AttachmentOwnerKind } from '../../../src/domains/school/attachment'
import { buildStorageKey } from '../../../src/storage/build-storage-key'
import { createInMemoryFileStorage } from '../../../src/storage/in-memory-file-storage'
import { sanitizeFileName } from '../../../src/storage/sanitize-file-name'

describe('buildStorageKey', () => {
  it('builds a multi-segment key with sanitized file name', () => {
    const key = buildStorageKey({
      schoolId: 'school-1',
      purpose: 'uploads',
      ownerKind: AttachmentOwnerKind.Incident,
      ownerId: 'incident-1',
      attachmentId: 'att-1',
      fileName: 'photo.jpg',
    })

    expect(key).toBe('school-1/uploads/incident/incident-1/att-1/photo.jpg')
  })
})

describe('sanitizeFileName', () => {
  it('strips path segments', () => {
    expect(sanitizeFileName('../evil/report.pdf')).toBe('..evilreport.pdf')
  })
})

describe('createInMemoryFileStorage', () => {
  it('stores and heads objects', async () => {
    const storage = createInMemoryFileStorage()
    await storage.putObject({
      key: 'school/uploads/student/student-1/att-1/file.pdf',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    })

    const head = await storage.headObject('school/uploads/student/student-1/att-1/file.pdf')
    expect(head?.sizeBytes).toBe(3)
    expect(head?.contentType).toBe('application/pdf')
  })
})
