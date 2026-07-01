import { describe, expect, it } from 'bun:test'
import { allowsPublicInlineAttachmentContent } from '../../../src/capabilities/files/attachment-inline-access'
import { buildAttachmentContentUrl } from '../../../src/capabilities/files/build-attachment-content-url'
import { AttachmentOwnerKind, AttachmentStatus } from '../../../src/domain/school/attachment'

describe('buildAttachmentContentUrl', () => {
  it('builds a stable content URL for an attachment', () => {
    expect(buildAttachmentContentUrl('http://localhost:9999', 'att-prof-staff-st1'))
      .toBe('http://localhost:9999/core/files/att-prof-staff-st1/content')
  })

  it('strips trailing slashes from the API base URL', () => {
    expect(buildAttachmentContentUrl('http://localhost:9999/', 'att-1'))
      .toBe('http://localhost:9999/core/files/att-1/content')
  })
})

describe('allowsPublicInlineAttachmentContent', () => {
  it('allows ready profile images for staff, students, and guardians', () => {
    for (const ownerKind of [
      AttachmentOwnerKind.Staff,
      AttachmentOwnerKind.Student,
      AttachmentOwnerKind.Guardian,
    ]) {
      expect(allowsPublicInlineAttachmentContent({
        ownerKind,
        mimeType: 'image/jpeg',
        status: AttachmentStatus.Ready,
      })).toBe(true)
    }
  })

  it('rejects non-image and non-profile attachments', () => {
    expect(allowsPublicInlineAttachmentContent({
      ownerKind: AttachmentOwnerKind.Incident,
      mimeType: 'image/jpeg',
      status: AttachmentStatus.Ready,
    })).toBe(false)

    expect(allowsPublicInlineAttachmentContent({
      ownerKind: AttachmentOwnerKind.Staff,
      mimeType: 'application/pdf',
      status: AttachmentStatus.Ready,
    })).toBe(false)

    expect(allowsPublicInlineAttachmentContent({
      ownerKind: AttachmentOwnerKind.Staff,
      mimeType: 'image/jpeg',
      status: AttachmentStatus.PendingUpload,
    })).toBe(false)
  })
})
