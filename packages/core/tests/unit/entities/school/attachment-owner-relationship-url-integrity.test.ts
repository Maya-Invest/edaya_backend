import { describe, expect, it } from 'bun:test'
import { Attachment, AttachmentOwnerKind } from '../../../../src/entities/school/attachment'

describe('Attachment entity owner relationship and URL integrity', () => {
  const baseArgs = {
    id: 'attachment-1',
    schoolId: 'school-1',
    ownerKind: AttachmentOwnerKind.Student,
    ownerId: 'student-1',
    fileName: 'report.pdf',
    fileUrl: 'https://cdn.school.example/files/report.pdf',
  }

  it('instantiates successfully with valid inputs and defaults', () => {
    const attachment = new Attachment(baseArgs)

    expect(attachment.id).toBe('attachment-1')
    expect(attachment.schoolId).toBe('school-1')
    expect(attachment.ownerKind).toBe(AttachmentOwnerKind.Student)
    expect(attachment.ownerId).toBe('student-1')
    expect(attachment.fileName).toBe('report.pdf')
    expect(attachment.fileUrl).toBe('https://cdn.school.example/files/report.pdf')
    expect(attachment.createdAt).toBeInstanceOf(Date)
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const attachment = new Attachment({
      ...baseArgs,
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      uploadedById: 'user-123',
      createdAt: createdDate,
    })

    expect(attachment.mimeType).toBe('application/pdf')
    expect(attachment.sizeBytes).toBe(1048576)
    expect(attachment.uploadedById).toBe('user-123')
    expect(attachment.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new Attachment({ ...baseArgs, id: '' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, schoolId: ' ' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, ownerId: '\t' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, fileName: ' \n' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, fileUrl: '  ' })).toThrow()
  })

  it('throws error when optional fields are empty or negative', () => {
    expect(() => new Attachment({ ...baseArgs, mimeType: ' ' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, uploadedById: ' \t ' })).toThrow()
    expect(() => new Attachment({ ...baseArgs, sizeBytes: 0 })).toThrow()
    expect(() => new Attachment({ ...baseArgs, sizeBytes: -500 })).toThrow()
  })
})
