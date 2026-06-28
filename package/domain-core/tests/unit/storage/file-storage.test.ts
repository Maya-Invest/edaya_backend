import { describe, expect, it } from 'bun:test'
import { AttachmentOwnerKind } from '../../../src/domains/school/attachment'
import { buildStorageKey } from '../../../src/storage/build-storage-key'
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
