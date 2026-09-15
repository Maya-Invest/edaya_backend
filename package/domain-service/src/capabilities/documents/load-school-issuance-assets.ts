import type { DocumentIssuanceSnapshot, ReadObjectResult, SchoolIssuanceAssetPurpose } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentOwnerKind, BusinessRuleViolationError, DOCUMENT_FAILURES, DOCUMENT_RENDER_BUDGET_BYTES, SCHOOL_CREST_PURPOSE, SCHOOL_ISSUANCE_ASSET_MAX_BYTES, SCHOOL_LOGO_PURPOSE, SCHOOL_SIGNATURE_PURPOSE, SCHOOL_STAMP_PURPOSE } from '@edaya/core'
import { loadAttachmentAsset } from '../files/load-attachment-asset'
import { schoolIssuanceAssetReadPolicy } from './issuance-asset-access'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export interface SchoolIssuanceAssetBytes {
  logo?: ReadObjectResult
  crest?: ReadObjectResult
  stamp?: ReadObjectResult
  signature?: ReadObjectResult
}

async function loadSlot(
  base: BaseSchoolService,
  schoolId: string,
  attachmentId: string | undefined,
  purpose: SchoolIssuanceAssetPurpose,
): Promise<ReadObjectResult | undefined> {
  if (!attachmentId)
    return undefined
  const attachment = await base.repositories.attachments.forSchool!(schoolId).findById(attachmentId)
  if (!attachment)
    return undefined
  const policy = await schoolIssuanceAssetReadPolicy(base, purpose, attachment)
  return loadAttachmentAsset(base, {
    attachmentId,
    ownerKind: AttachmentOwnerKind.School,
    ownerId: schoolId,
    maxBytes: SCHOOL_ISSUANCE_ASSET_MAX_BYTES,
    allowedMimeTypes: IMAGE_TYPES,
    access: policy,
  })
}

export async function loadSchoolIssuanceAssets(
  base: BaseSchoolService,
  schoolId: string,
  snapshot?: Pick<DocumentIssuanceSnapshot, 'logoAttachmentId' | 'crestAttachmentId' | 'stampAttachmentId' | 'signatureAttachmentId'>,
): Promise<SchoolIssuanceAssetBytes> {
  const school = await base.repositories.schools.findById(schoolId)
  if (!school || school.id !== base.actor.schoolId)
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.SOURCE_INACCESSIBLE, 'School is not available for issuance assets')
  const assets: SchoolIssuanceAssetBytes = {
    logo: await loadSlot(base, schoolId, snapshot?.logoAttachmentId ?? school.logoAttachmentId, SCHOOL_LOGO_PURPOSE),
    crest: await loadSlot(base, schoolId, snapshot?.crestAttachmentId ?? school.crestAttachmentId, SCHOOL_CREST_PURPOSE),
    stamp: await loadSlot(base, schoolId, snapshot?.stampAttachmentId ?? school.stampAttachmentId, SCHOOL_STAMP_PURPOSE),
    signature: await loadSlot(base, schoolId, snapshot?.signatureAttachmentId ?? school.signatureAttachmentId, SCHOOL_SIGNATURE_PURPOSE),
  }
  const total = (assets.logo?.body.byteLength ?? 0)
    + (assets.crest?.body.byteLength ?? 0)
    + (assets.stamp?.body.byteLength ?? 0)
    + (assets.signature?.body.byteLength ?? 0)
  if (total > DOCUMENT_RENDER_BUDGET_BYTES)
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.ASSET_MISSING, 'Issuance assets exceed the render budget')
  return assets
}
