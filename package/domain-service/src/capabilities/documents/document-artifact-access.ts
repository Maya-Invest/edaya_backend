import type { Attachment, DocumentIssuance } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy } from '../files/attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentOwnerKind, DOCUMENT_ISSUANCE_PURPOSE, resourceAccessScope } from '@edaya/core'

export function documentArtifactReadPolicy(base: BaseSchoolService, issuance: DocumentIssuance): AttachmentReadPolicy {
  return {
    purpose: DOCUMENT_ISSUANCE_PURPOSE,
    readScope: async () => {
      const current = await base.repositories.documentIssuances.findById(issuance.id)
      if (!current)
        denyResourceAccess()
      await base.access.documents.assertDownload(current)
      return resourceAccessScope(base.actor.schoolId, 'attachments', [{
        target: { kind: 'school' },
        attachmentOwners: [AttachmentOwnerKind.DocumentIssuance],
        attachmentPurposes: [DOCUMENT_ISSUANCE_PURPOSE],
        attachmentIds: current.artifactAttachmentId ? [current.artifactAttachmentId] : [],
      }])
    },
  }
}

export async function documentArtifactReadPolicyForAttachment(
  base: BaseSchoolService,
  attachment: Attachment,
): Promise<AttachmentReadPolicy | undefined> {
  if (attachment.ownerKind !== AttachmentOwnerKind.DocumentIssuance || attachment.purpose !== DOCUMENT_ISSUANCE_PURPOSE)
    return undefined
  const issuance = await base.repositories.documentIssuances.findById(attachment.ownerId)
  if (!issuance || issuance.artifactAttachmentId !== attachment.id)
    return undefined
  return documentArtifactReadPolicy(base, issuance)
}
