import { AttachmentOwnerKind, AttachmentStatus, GENERAL_ATTACHMENT_PURPOSE } from '@edaya/core'

const PUBLIC_INLINE_OWNER_KINDS = new Set<AttachmentOwnerKind>([
  AttachmentOwnerKind.Staff,
  AttachmentOwnerKind.Student,
  AttachmentOwnerKind.Guardian,
])

export interface AttachmentInlineAccessInput {
  ownerKind: AttachmentOwnerKind
  purpose?: string
  mimeType?: string | null
  status: AttachmentStatus
}

export function allowsPublicInlineAttachmentContent(
  attachment: AttachmentInlineAccessInput,
): boolean {
  if (attachment.status !== AttachmentStatus.Ready || (attachment.purpose ?? GENERAL_ATTACHMENT_PURPOSE) !== GENERAL_ATTACHMENT_PURPOSE) {
    return false
  }

  if (!PUBLIC_INLINE_OWNER_KINDS.has(attachment.ownerKind)) {
    return false
  }

  const mimeType = attachment.mimeType?.trim().toLowerCase() ?? ''
  return mimeType.startsWith('image/')
}
