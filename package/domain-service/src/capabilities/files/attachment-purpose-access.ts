import type { Attachment, ResourceAccessScope } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { attachmentPurposeSchema, GENERAL_ATTACHMENT_PURPOSE } from '@edaya/core'

/** Internal hook from a named feature policy, never deserialized from a request. */
export interface AttachmentReadPolicy {
  readonly purpose: string
  /** Re-evaluate current actor, feature lifecycle and resource authority on every invocation. */
  readonly readScope: () => Promise<ResourceAccessScope>
}

/** Named feature commands fix purpose and reauthorize both existing and proposed targets. */
export interface AttachmentUploadPolicy {
  readonly purpose: string
  readonly assertSave: (attachment: Attachment, existing: Attachment | undefined) => Promise<ResourceAccessScope>
  readonly allowedMimeTypes?: readonly string[]
  readonly maxBytes?: number
}

export function attachmentPurpose(policy?: { readonly purpose: string }): string {
  const result = attachmentPurposeSchema.safeParse(policy?.purpose ?? GENERAL_ATTACHMENT_PURPOSE)
  if (!result.success)
    denyResourceAccess()
  return result.data
}

export function assertAttachmentScope(base: BaseSchoolService, scope: ResourceAccessScope): void {
  if (scope.schoolId !== base.actor.schoolId || scope.resource !== 'attachments')
    denyResourceAccess()
}

export async function readPurposeAttachment(base: BaseSchoolService, id: string, policy?: AttachmentReadPolicy) {
  const purpose = attachmentPurpose(policy)
  const scope = policy ? await policy.readScope() : await base.access.entity('attachments').readScope()
  assertAttachmentScope(base, scope)
  // Purpose is a conjunctive policy predicate before SQL LIMIT/counts, never a client filter.
  const attachment = await base.repositories.attachments.forAccess(scope).findById(id)
  return attachment?.purpose === purpose ? attachment : undefined
}
