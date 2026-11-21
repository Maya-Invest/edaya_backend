import type { Attachment, PresignedDownload } from '@edaya/core'
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
  const grant = await signAttachmentDownload(base, attachment, attachment.storageKey, options.inlineImages)
  const current = await readPurposeAttachment(base, attachmentId, options.access)
  if (!current)
    denyResourceAccess()
  if (JSON.stringify(current.data) !== JSON.stringify(attachment.data))
    throw new BusinessRuleViolationError('ATTACHMENT_CHANGED', 'Attachment changed while granting download access')
  return grant
}

/** Both download paths recheck the current access and attachment after this external call. */
export async function signAttachmentDownload(base: BaseSchoolService, attachment: Attachment, storageKey: string, inlineImages = false): Promise<PresignedDownload> {
  try {
    return await base.fileStorage.createPresignedDownload(storageKey, {
      fileName: attachment.fileName,
      expiresInSeconds: 900,
      disposition: inlineImages && attachment.mimeType?.startsWith('image/') ? 'inline' : 'attachment',
    })
  }
  catch {
    throw new Error('ATTACHMENT_STORAGE_UNAVAILABLE')
  }
}
