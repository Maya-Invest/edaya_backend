import { AttachmentOwnerKind, AttachmentStatus } from '../domains/school/attachment'

const PUBLIC_INLINE_OWNER_KINDS = new Set<AttachmentOwnerKind>([
  AttachmentOwnerKind.Staff,
  AttachmentOwnerKind.Student,
  AttachmentOwnerKind.Guardian,
])

export interface AttachmentInlineAccessInput {
  ownerKind: AttachmentOwnerKind
  mimeType?: string | null
  status: AttachmentStatus
}

export function allowsPublicInlineAttachmentContent(
  attachment: AttachmentInlineAccessInput,
): boolean {
  if (attachment.status !== AttachmentStatus.Ready) {
    return false
  }

  if (!PUBLIC_INLINE_OWNER_KINDS.has(attachment.ownerKind)) {
    return false
  }

  const mimeType = attachment.mimeType?.trim().toLowerCase() ?? ''
  return mimeType.startsWith('image/')
}
