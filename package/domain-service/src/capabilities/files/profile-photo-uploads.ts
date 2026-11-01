import type { Attachment, AttachmentInput, AttachmentOwnerKind } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { isProfilePhotoPurpose, profilePhotoPurposeForOwner } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload } from './attachment-uploads'
import { profilePhotoUploadPolicy } from './profile-photo-access'
import { retainUnsubmittedStudentPortrait } from './student-photo-lifecycle'

export interface CreateProfilePhotoUploadInput {
  ownerKind: AttachmentOwnerKind
  ownerId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  attachmentId?: string
}

export async function createProfilePhotoUpload(base: BaseSchoolService, input: CreateProfilePhotoUploadInput) {
  const policy = await profilePhotoUploadPolicy(base, input.ownerKind, input.ownerId)
  return createAttachmentUpload(base, input, policy)
}

export async function completeProfilePhotoUpload(base: BaseSchoolService, input: AttachmentInput): Promise<Attachment> {
  const purpose = profilePhotoPurposeForOwner(input.ownerKind)
  const policy = await profilePhotoUploadPolicy(base, input.ownerKind, input.ownerId)
  const attachment = await completeAttachmentUpload(base, { ...input, purpose }, policy)
  await base.atomicExecution.execute(async () => {
    await retainUnsubmittedStudentPortrait(base, attachment)
  })
  return attachment
}

export function assertGenericAttachmentIsNotPortrait(purpose: string | undefined): void {
  if (purpose && isProfilePhotoPurpose(purpose))
    denyResourceAccess()
}
