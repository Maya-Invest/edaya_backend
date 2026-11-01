import { AttachmentOwnerKind, GUARDIAN_PORTRAIT_PURPOSE, parseAttachmentIdFromContentUrl, profilePhotoPurposeForOwner, STAFF_PORTRAIT_PURPOSE, STUDENT_PHOTO_ABANDONED_MS, STUDENT_PHOTO_TERMINAL_RETAIN_MS, STUDENT_PORTRAIT_PURPOSE, TEACHER_PORTRAIT_PURPOSE } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('parseAttachmentIdFromContentUrl', () => {
  test('accepts relative and absolute private content projections, including query strings', () => {
    expect(parseAttachmentIdFromContentUrl('/core/files/att-1/content')).toBe('att-1')
    expect(parseAttachmentIdFromContentUrl('https://school.api.test/core/files/att-2/content?v=1')).toBe('att-2')
    expect(parseAttachmentIdFromContentUrl('https://school.api.test/core/files/att-3/content#preview')).toBe('att-3')
  })

  test('rejects signed URLs and non-content paths', () => {
    expect(parseAttachmentIdFromContentUrl('https://files.test/memory/key?signature=secret')).toBeUndefined()
    expect(parseAttachmentIdFromContentUrl('/core/files/att-1/download')).toBeUndefined()
    expect(parseAttachmentIdFromContentUrl('')).toBeUndefined()
  })
})

describe('student portrait retention windows', () => {
  test('abandoned unsubmitted portraits last 24 hours and terminal proposals last 30 days', () => {
    expect(STUDENT_PHOTO_ABANDONED_MS).toBe(24 * 60 * 60 * 1000)
    expect(STUDENT_PHOTO_TERMINAL_RETAIN_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

describe('profilePhotoPurposeForOwner', () => {
  test('maps people owners onto their portrait purposes', () => {
    expect(profilePhotoPurposeForOwner(AttachmentOwnerKind.Student)).toBe(STUDENT_PORTRAIT_PURPOSE)
    expect(profilePhotoPurposeForOwner(AttachmentOwnerKind.Guardian)).toBe(GUARDIAN_PORTRAIT_PURPOSE)
    expect(profilePhotoPurposeForOwner(AttachmentOwnerKind.Staff)).toBe(STAFF_PORTRAIT_PURPOSE)
    expect(profilePhotoPurposeForOwner(AttachmentOwnerKind.Teacher)).toBe(TEACHER_PORTRAIT_PURPOSE)
  })
})
