import type { AttachmentOwnerKind, CommandJson } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { Attachment, BusinessRuleViolationError } from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'

interface RemovedAttachmentReference extends Record<string, CommandJson> {
  attachmentId: string
  ownerKind: AttachmentOwnerKind
  ownerId: string
  purpose: string
}

/** Metadata, cleanup eligibility, receipt and minimal audit commit together. No storage I/O. */
export async function removeAttachment(base: BaseSchoolService, attachmentId: string): Promise<void> {
  if (!attachmentId.trim())
    denyResourceAccess()
  await base.commandExecution.execute<RemovedAttachmentReference, RemovedAttachmentReference>({
    scope: await schoolCommandScope(base.actor, 'removeAttachment', attachmentId),
    input: { attachmentId },
    resultMode: 'ordinary',
    lockKeys: [`attachment-upload:${attachmentId}`],
    authorize: () => base.access.attachments.assertConfigure(),
    execute: async () => {
      const existing = await base.entities.attachments.findById(attachmentId)
      if (!existing)
        denyResourceAccess()
      const scope = await base.access.attachments.assertRemove(existing)
      await base.repositories.privateFiles.assertRemovable(existing.schoolId, existing.id)
      await base.repositories.attachments.forAccess(scope).delete(existing.id)
      if (existing.storageKey)
        await base.repositories.privateFiles.expedite(existing.schoolId, existing.storageKey)
      return { attachmentId, ownerKind: existing.ownerKind, ownerId: existing.ownerId, purpose: existing.purpose }
    },
    replay: async (stored) => {
      if (stored.attachmentId !== attachmentId || await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachmentId))
        throw new BusinessRuleViolationError('ATTACHMENT_REMOVAL_RESULT_UNAVAILABLE', 'The removal result is no longer available')
      // Recheck current authority over the original owner even though metadata was deleted.
      await base.access.attachments.assertRemove(new Attachment({ id: attachmentId, schoolId: base.actor.schoolId, ownerKind: stored.ownerKind, ownerId: stored.ownerId, purpose: stored.purpose, fileName: 'removed-attachment', storageKey: 'removed-reference' }))
      return stored
    },
    persistResult: result => ({ attachmentId: result.attachmentId, ownerKind: result.ownerKind, ownerId: result.ownerId, purpose: result.purpose }),
    audit: result => [{ event: 'attachment.removed', resourceType: 'attachment', resourceId: result.attachmentId }],
  })
}
