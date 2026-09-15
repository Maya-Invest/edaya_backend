import type { Attachment, AttachmentInput, SchoolIssuanceAssetPurpose } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentOwnerKind, BusinessRuleViolationError, DOCUMENT_FAILURES, School, SCHOOL_ISSUANCE_ASSET_CAPABILITY } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload } from '../files/attachment-uploads'
import { isSchoolIssuanceAssetPurpose, schoolIssuanceAssetSlot, schoolIssuanceAssetUploadPolicy } from './issuance-asset-access'

export interface CreateSchoolIssuanceAssetUploadInput {
  purpose: SchoolIssuanceAssetPurpose
  fileName: string
  mimeType: string
  sizeBytes: number
  attachmentId?: string
}

export async function createSchoolIssuanceAssetUpload(base: BaseSchoolService, input: CreateSchoolIssuanceAssetUploadInput) {
  if (!isSchoolIssuanceAssetPurpose(input.purpose))
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED, 'Unknown school issuance asset purpose')
  const schoolId = base.actor.schoolId
  const policy = await schoolIssuanceAssetUploadPolicy(base, input.purpose, schoolId)
  return createAttachmentUpload(base, {
    ownerKind: AttachmentOwnerKind.School,
    ownerId: schoolId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    attachmentId: input.attachmentId,
  }, policy)
}

export async function completeSchoolIssuanceAssetUpload(base: BaseSchoolService, input: AttachmentInput & { purpose: SchoolIssuanceAssetPurpose }): Promise<Attachment> {
  if (!isSchoolIssuanceAssetPurpose(input.purpose))
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED, 'Unknown school issuance asset purpose')
  const schoolId = base.actor.schoolId
  const policy = await schoolIssuanceAssetUploadPolicy(base, input.purpose, schoolId)
  const attachment = await completeAttachmentUpload(base, {
    ...input,
    ownerKind: AttachmentOwnerKind.School,
    ownerId: schoolId,
    purpose: input.purpose,
  }, policy)
  const slot = schoolIssuanceAssetSlot(input.purpose)
  await base.atomicExecution.execute(async () => {
    await base.access.documents.assertConfigureIssuanceAssets()
    const existing = await base.repositories.schools.findById(schoolId)
    if (!existing)
      throw new BusinessRuleViolationError(DOCUMENT_FAILURES.SOURCE_MISSING, 'School was not found')
    const previousId = existing[slot]
    const school = new School({
      ...existing.data,
      [slot]: attachment.id,
      issuanceAssetVersion: existing.issuanceAssetVersion + 1,
    })
    await base.repositories.schools.forSchool!(schoolId).save(school)
    if (attachment.storageKey) {
      await base.repositories.privateFiles.retain({
        schoolId,
        sourceType: SCHOOL_ISSUANCE_ASSET_CAPABILITY,
        sourceId: schoolId,
        slot: input.purpose,
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
      })
    }
    if (previousId && previousId !== attachment.id) {
      const previous = await base.repositories.attachments.forSchool!(schoolId).findById(previousId)
      if (previous?.storageKey) {
        await base.repositories.privateFiles.reserve({
          schoolId,
          storageKey: previous.storageKey,
          protectedUntil: new Date(Date.now() + 60 * 60 * 1000),
        })
      }
    }
  })
  return attachment
}
