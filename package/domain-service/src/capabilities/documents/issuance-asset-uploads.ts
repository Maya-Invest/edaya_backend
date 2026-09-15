import type { Attachment, AttachmentInput, School, SchoolIssuanceAssetPurpose } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentOwnerKind, BusinessRuleViolationError, DOCUMENT_FAILURES } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload } from '../files/attachment-uploads'
import { isSchoolIssuanceAssetPurpose, schoolIssuanceAssetUploadPolicy } from './issuance-asset-access'
import { writeSchoolIssuanceSlot } from './issuance-asset-lifecycle'

export interface CreateSchoolIssuanceAssetUploadInput {
  purpose: SchoolIssuanceAssetPurpose
  fileName: string
  mimeType: string
  sizeBytes: number
  attachmentId?: string
}

export interface ClearSchoolIssuanceAssetInput {
  purpose: SchoolIssuanceAssetPurpose
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
  await base.atomicExecution.execute(async () => {
    await writeSchoolIssuanceSlot(base, input.purpose, attachment)
  })
  return attachment
}

export async function clearSchoolIssuanceAsset(base: BaseSchoolService, input: ClearSchoolIssuanceAssetInput): Promise<School> {
  if (!isSchoolIssuanceAssetPurpose(input.purpose))
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED, 'Unknown school issuance asset purpose')
  return base.atomicExecution.execute(async () => writeSchoolIssuanceSlot(base, input.purpose, undefined))
}
