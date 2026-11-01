import type { PresignedDownload } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy } from './attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentStatus, BusinessRuleViolationError } from '@edaya/core'

import { readPurposeAttachment } from './attachment-purpose-access'

/** Scope before metadata reads and reauthorize after signing; call outside SQL transactions. */
export async function grantAttachmentDownload(
  base: BaseSchoolService,
  attachmentId: string,
  options: { inlineImages?: boolean, access?: AttachmentReadPolicy } = {},
): Promise<PresignedDownload | null> {
  const attachment = await readPurposeAttachment(base, attachmentId, options.access)
  if (!attachment || attachment.status !== AttachmentStatus.Ready || !attachment.storageKey)
    return null
  // Historical external links have no enforceable grant expiry. Preserve their
  // metadata for the owning migration, but never issue them as private delivery.
  let grant: PresignedDownload
  try {
    grant = await base.fileStorage.createPresignedDownload(attachment.storageKey, {
      fileName: attachment.fileName,
      expiresInSeconds: 900,
      disposition: options.inlineImages && attachment.mimeType?.startsWith('image/') ? 'inline' : 'attachment',
    })
  }
  catch {
    throw new Error('ATTACHMENT_STORAGE_UNAVAILABLE')
  }
  const current = await readPurposeAttachment(base, attachmentId, options.access)
  if (!current)
    denyResourceAccess()
  if (JSON.stringify(current.data) !== JSON.stringify(attachment.data))
    throw new BusinessRuleViolationError('ATTACHMENT_CHANGED', 'Attachment changed while granting download access')
  return grant
}
