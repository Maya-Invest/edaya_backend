import { AttachmentOwnerKind, BusinessRuleViolationError } from '@edaya/core'

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const PDF_MAX_BYTES = 25 * 1024 * 1024

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/apng',
  'image/webp',
  'image/gif',
])

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function allowedMimeTypesForOwner(ownerKind: AttachmentOwnerKind): ReadonlySet<string> {
  switch (ownerKind) {
    case AttachmentOwnerKind.Student:
    case AttachmentOwnerKind.Guardian:
    case AttachmentOwnerKind.Staff:
      return new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES])
    case AttachmentOwnerKind.ReportCard:
    case AttachmentOwnerKind.Incident:
    case AttachmentOwnerKind.StudentDisciplinaryAction:
      return new Set(['application/pdf', ...IMAGE_MIME_TYPES])
    default:
      return new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES])
  }
}

function maxBytesForOwner(ownerKind: AttachmentOwnerKind): number {
  switch (ownerKind) {
    case AttachmentOwnerKind.ReportCard:
    case AttachmentOwnerKind.Incident:
      return PDF_MAX_BYTES
    default:
      return DEFAULT_MAX_BYTES
  }
}

export function assertUploadPolicyAllowed(input: {
  ownerKind: AttachmentOwnerKind
  mimeType: string
  sizeBytes: number
}): void {
  const allowedMimeTypes = allowedMimeTypesForOwner(input.ownerKind)
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new BusinessRuleViolationError(
      'UPLOAD_MIME_TYPE_NOT_ALLOWED',
      `MIME type ${input.mimeType} is not allowed for ${input.ownerKind}`,
    )
  }

  const maxBytes = maxBytesForOwner(input.ownerKind)
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > maxBytes) {
    throw new BusinessRuleViolationError(
      'UPLOAD_SIZE_NOT_ALLOWED',
      `Upload size must be between 1 and ${maxBytes} bytes`,
    )
  }
}
