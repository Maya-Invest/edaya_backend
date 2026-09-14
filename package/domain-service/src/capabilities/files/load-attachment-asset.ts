import type { AttachmentOwnerKind, ReadObjectResult } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy } from './attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import { assertStorageReadLimit, AttachmentStatus, BusinessRuleViolationError } from '@edaya/core'

import { readPurposeAttachment } from './attachment-purpose-access'

export interface AttachmentAssetRequest {
  access?: AttachmentReadPolicy
  attachmentId: string
  /** Fixed by the consuming capability's authoritative resource, never an arbitrary URL/key. */
  ownerKind: AttachmentOwnerKind
  ownerId: string
  maxBytes: number
  allowedMimeTypes: readonly string[]
}

/** Invoke outside business transactions. Consumers supply their own narrower purpose policy. */
export async function loadAttachmentAsset(base: BaseSchoolService, request: AttachmentAssetRequest): Promise<ReadObjectResult> {
  assertStorageReadLimit(request.maxBytes)
  async function authorizedAttachment() {
    const attachment = await readPurposeAttachment(base, request.attachmentId, request.access)
    if (!attachment || attachment.schoolId !== base.actor.schoolId
      || attachment.ownerKind !== request.ownerKind || attachment.ownerId !== request.ownerId) {
      denyResourceAccess()
    }
    if (attachment.status !== AttachmentStatus.Ready || !attachment.storageKey) {
      throw new BusinessRuleViolationError('ATTACHMENT_NOT_READY', 'A ready private attachment is required')
    }
    if (!attachment.mimeType || !request.allowedMimeTypes.includes(attachment.mimeType)) {
      throw new BusinessRuleViolationError('ATTACHMENT_ASSET_TYPE_NOT_ALLOWED', 'Attachment type is not allowed for this asset')
    }
    if (!attachment.sizeBytes || attachment.sizeBytes > request.maxBytes) {
      throw new BusinessRuleViolationError('ATTACHMENT_ASSET_SIZE_NOT_ALLOWED', 'Attachment size is not allowed for this asset')
    }
    return attachment
  }

  const attachment = await authorizedAttachment()
  const stored = await base.fileStorage.readObject(attachment.storageKey!, { maxBytes: request.maxBytes })
  // A long object read must not disclose bytes after access or the resource changed.
  const current = await authorizedAttachment()
  if (JSON.stringify(current.data) !== JSON.stringify(attachment.data)) {
    throw new BusinessRuleViolationError('ATTACHMENT_CHANGED', 'Attachment changed during asset loading')
  }
  if (!stored) {
    throw new BusinessRuleViolationError('ATTACHMENT_OBJECT_NOT_FOUND', 'Attachment object was not found')
  }
  if (stored.body.byteLength !== attachment.sizeBytes || stored.sizeBytes !== stored.body.byteLength) {
    throw new BusinessRuleViolationError('ATTACHMENT_SIZE_MISMATCH', 'Attachment object size does not match its record')
  }
  if (stored.contentType !== attachment.mimeType) {
    throw new BusinessRuleViolationError('ATTACHMENT_MIME_TYPE_MISMATCH', 'Attachment object type does not match its record')
  }
  return stored
}
