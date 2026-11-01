import type { BusinessRuleViolationError } from '@edaya/core'
import { AttachmentOwnerKind } from '@edaya/core'
import { assertUploadPolicyAllowed } from '@edaya/service'
import { describe, expect, test } from 'bun:test'

describe('assertUploadPolicyAllowed', () => {
  test('allows profile uploads for staff actors within the default size limit', () => {
    expect(() => assertUploadPolicyAllowed({
      ownerKind: AttachmentOwnerKind.Staff,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    })).not.toThrow()
  })

  test('rejects disallowed mime types for report card owners', () => {
    expect(() => assertUploadPolicyAllowed({
      ownerKind: AttachmentOwnerKind.ReportCard,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 1024,
    })).toThrowError(expect.objectContaining({
      code: 'UPLOAD_MIME_TYPE_NOT_ALLOWED',
    } satisfies Partial<BusinessRuleViolationError>))
  })

  test('allows PDF uploads for incident owners up to the PDF limit', () => {
    expect(() => assertUploadPolicyAllowed({
      ownerKind: AttachmentOwnerKind.Incident,
      mimeType: 'application/pdf',
      sizeBytes: 20 * 1024 * 1024,
    })).not.toThrow()
  })

  test('rejects empty or oversized uploads', () => {
    expect(() => assertUploadPolicyAllowed({
      ownerKind: AttachmentOwnerKind.Student,
      mimeType: 'image/png',
      sizeBytes: 0,
    })).toThrowError(expect.objectContaining({
      code: 'UPLOAD_SIZE_NOT_ALLOWED',
    } satisfies Partial<BusinessRuleViolationError>))

    expect(() => assertUploadPolicyAllowed({
      ownerKind: AttachmentOwnerKind.Student,
      mimeType: 'image/png',
      sizeBytes: 11 * 1024 * 1024,
    })).toThrowError(expect.objectContaining({
      code: 'UPLOAD_SIZE_NOT_ALLOWED',
    } satisfies Partial<BusinessRuleViolationError>))
  })

  test('rejects non-integer and non-finite byte counts at the service boundary', () => {
    for (const sizeBytes of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assertUploadPolicyAllowed({ ownerKind: AttachmentOwnerKind.Staff, mimeType: 'image/png', sizeBytes }))
        .toThrowError(expect.objectContaining({ code: 'UPLOAD_SIZE_NOT_ALLOWED' }))
    }
  })
})
