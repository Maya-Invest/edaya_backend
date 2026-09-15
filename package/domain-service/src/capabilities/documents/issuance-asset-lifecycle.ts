import type { Attachment, DocumentIssuanceSnapshot, School, SchoolIssuanceAssetPurpose } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import {
  AttachmentOwnerKind,
  BusinessRuleViolationError,
  DOCUMENT_FAILURES,
  DOCUMENT_ISSUANCE_CAPABILITY,
  School as SchoolEntity,
  SCHOOL_ISSUANCE_ASSET_CAPABILITY,
  SCHOOL_ISSUANCE_ASSET_TERMINAL_RETAIN_MS,
  SCHOOL_LOGO_PURPOSE,
  SCHOOL_CREST_PURPOSE,
  SCHOOL_STAMP_PURPOSE,
  SCHOOL_SIGNATURE_PURPOSE,
} from '@edaya/core'
import { isPublicBrandingPurpose, isSchoolIssuanceAssetPurpose, schoolIssuanceAssetSlot } from './issuance-asset-access'

export async function retainCurrentIssuanceAsset(
  base: BaseSchoolService,
  schoolId: string,
  purpose: SchoolIssuanceAssetPurpose,
  attachment: Attachment,
): Promise<void> {
  if (!attachment.storageKey)
    return
  await base.repositories.privateFiles.retain({
    schoolId,
    sourceType: SCHOOL_ISSUANCE_ASSET_CAPABILITY,
    sourceId: schoolId,
    slot: purpose,
    attachmentId: attachment.id,
    storageKey: attachment.storageKey,
  })
}

export async function reserveReplacedIssuanceAsset(
  base: BaseSchoolService,
  schoolId: string,
  previousId: string | undefined,
  nextId: string | undefined,
): Promise<void> {
  if (!previousId || previousId === nextId)
    return
  const previous = await base.repositories.attachments.forSchool!(schoolId).findById(previousId)
  if (previous?.storageKey) {
    await base.repositories.privateFiles.reserve({
      schoolId,
      storageKey: previous.storageKey,
      protectedUntil: new Date(Date.now() + SCHOOL_ISSUANCE_ASSET_TERMINAL_RETAIN_MS),
    })
  }
  await detachUnreferencedSchoolIssuanceAsset(base, previousId)
}

export async function detachUnreferencedSchoolIssuanceAsset(
  base: BaseSchoolService,
  attachmentId: string | undefined,
): Promise<boolean> {
  if (!attachmentId)
    return false
  const schoolId = base.actor.schoolId
  const attachment = await base.repositories.attachments.forSchool!(schoolId).findById(attachmentId)
  if (!attachment || attachment.ownerKind !== AttachmentOwnerKind.School || !isSchoolIssuanceAssetPurpose(attachment.purpose))
    return false
  const school = await base.repositories.schools.findById(schoolId)
  const slot = schoolIssuanceAssetSlot(attachment.purpose)
  if (school?.[slot] === attachment.id)
    return false
  try {
    await base.repositories.privateFiles.assertRemovable(attachment.schoolId, attachment.id)
  }
  catch (error) {
    if (error instanceof BusinessRuleViolationError && error.code === 'ATTACHMENT_REFERENCED')
      return false
    throw error
  }
  await base.repositories.attachments.forSchool!(attachment.schoolId).delete(attachment.id)
  return true
}

export async function retainIssuanceSnapshotAssets(
  base: BaseSchoolService,
  issuanceId: string,
  snapshot: DocumentIssuanceSnapshot,
): Promise<void> {
  const schoolId = base.actor.schoolId
  const slots: Array<{ purpose: SchoolIssuanceAssetPurpose, attachmentId?: string }> = [
    { purpose: SCHOOL_LOGO_PURPOSE, attachmentId: snapshot.logoAttachmentId },
    { purpose: SCHOOL_CREST_PURPOSE, attachmentId: snapshot.crestAttachmentId },
    { purpose: SCHOOL_STAMP_PURPOSE, attachmentId: snapshot.stampAttachmentId },
    { purpose: SCHOOL_SIGNATURE_PURPOSE, attachmentId: snapshot.signatureAttachmentId },
  ]
  for (const slot of slots) {
    if (!slot.attachmentId)
      continue
    const attachment = await base.repositories.attachments.forSchool!(schoolId).findById(slot.attachmentId)
    if (!attachment?.storageKey || attachment.purpose !== slot.purpose)
      continue
    await base.repositories.privateFiles.retain({
      schoolId,
      sourceType: DOCUMENT_ISSUANCE_CAPABILITY,
      sourceId: issuanceId,
      slot: slot.purpose,
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
    })
  }
}

function brandingPurposesWithout(school: School, purpose: SchoolIssuanceAssetPurpose): School['publicBrandingPurposes'] {
  if (!isPublicBrandingPurpose(purpose))
    return school.publicBrandingPurposes
  return school.publicBrandingPurposes.filter(entry => entry !== purpose)
}

export async function writeSchoolIssuanceSlot(
  base: BaseSchoolService,
  purpose: SchoolIssuanceAssetPurpose,
  nextAttachment: Attachment | undefined,
): Promise<School> {
  await base.access.documents.assertConfigureIssuanceAssets()
  const schoolId = base.actor.schoolId
  const existing = await base.repositories.schools.findById(schoolId)
  if (!existing)
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.SOURCE_MISSING, 'School was not found')
  const slot = schoolIssuanceAssetSlot(purpose)
  const previousId = existing[slot]
  const school = new SchoolEntity({
    ...existing.data,
    [slot]: nextAttachment?.id,
    issuanceAssetVersion: existing.issuanceAssetVersion + 1,
    publicBrandingPurposes: nextAttachment ? existing.publicBrandingPurposes : brandingPurposesWithout(existing, purpose),
  })
  await base.repositories.schools.forSchool!(schoolId).save(school)
  if (nextAttachment)
    await retainCurrentIssuanceAsset(base, schoolId, purpose, nextAttachment)
  else {
    await base.repositories.privateFiles.release({
      schoolId,
      sourceType: SCHOOL_ISSUANCE_ASSET_CAPABILITY,
      sourceId: schoolId,
      slot: purpose,
    })
  }
  await reserveReplacedIssuanceAsset(base, schoolId, previousId, nextAttachment?.id)
  return school
}
