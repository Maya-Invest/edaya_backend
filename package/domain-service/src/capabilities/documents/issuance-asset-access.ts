import type { Attachment, ResourceAccessScope, SchoolIssuanceAssetPurpose } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy, AttachmentUploadPolicy } from '../files/attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import {
  AttachmentOwnerKind,
  AttachmentStatus,
  resourceAccessScope,
  SCHOOL_CREST_PURPOSE,
  SCHOOL_ISSUANCE_ASSET_MAX_BYTES,
  SCHOOL_ISSUANCE_ASSET_PURPOSES,
  SCHOOL_LOGO_PURPOSE,
  SCHOOL_PUBLIC_BRANDING_PURPOSES,
  SCHOOL_SIGNATURE_PURPOSE,
  SCHOOL_STAMP_PURPOSE,
} from '@edaya/core'
import { validateAttachmentSave } from '../../services/entities/config/school/attachment'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const SCHOOL_ACTOR_KINDS = new Set(['staff', 'teacher', 'guardian', 'student', 'system'])

export function isSchoolIssuanceAssetPurpose(purpose: string): purpose is SchoolIssuanceAssetPurpose {
  return (SCHOOL_ISSUANCE_ASSET_PURPOSES as readonly string[]).includes(purpose)
}

export function isPublicBrandingPurpose(purpose: string): purpose is typeof SCHOOL_PUBLIC_BRANDING_PURPOSES[number] {
  return (SCHOOL_PUBLIC_BRANDING_PURPOSES as readonly string[]).includes(purpose)
}

export function schoolIssuanceAssetSlot(purpose: SchoolIssuanceAssetPurpose): 'logoAttachmentId' | 'crestAttachmentId' | 'stampAttachmentId' | 'signatureAttachmentId' {
  switch (purpose) {
    case SCHOOL_LOGO_PURPOSE:
      return 'logoAttachmentId'
    case SCHOOL_CREST_PURPOSE:
      return 'crestAttachmentId'
    case SCHOOL_STAMP_PURPOSE:
      return 'stampAttachmentId'
    case SCHOOL_SIGNATURE_PURPOSE:
      return 'signatureAttachmentId'
  }
}

function issuanceAssetScope(schoolId: string, purpose: SchoolIssuanceAssetPurpose, attachmentIds?: readonly string[]): ResourceAccessScope {
  return resourceAccessScope(schoolId, 'attachments', [{
    target: { kind: 'school' },
    attachmentOwners: [AttachmentOwnerKind.School],
    attachmentPurposes: [purpose],
    ...(attachmentIds ? { attachmentIds } : {}),
  }])
}

async function assertIssuanceAssetAuthority(base: BaseSchoolService, _purpose: SchoolIssuanceAssetPurpose): Promise<void> {
  await base.access.documents.assertConfigureIssuanceAssets()
}

async function isAllowlistedPublicBranding(
  base: BaseSchoolService,
  purpose: SchoolIssuanceAssetPurpose,
  attachment?: Attachment,
): Promise<boolean> {
  if (!isPublicBrandingPurpose(purpose) || !SCHOOL_ACTOR_KINDS.has(base.actor.kind))
    return false
  if (attachment && (
    attachment.ownerKind !== AttachmentOwnerKind.School
    || attachment.ownerId !== base.actor.schoolId
    || attachment.schoolId !== base.actor.schoolId
    || attachment.purpose !== purpose
    || attachment.status !== AttachmentStatus.Ready
  )) {
    return false
  }
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  if (!school?.publicBrandingPurposes.includes(purpose))
    return false
  const currentId = school[schoolIssuanceAssetSlot(purpose)]
  if (!currentId)
    return false
  return !attachment || attachment.id === currentId
}

export async function schoolIssuanceAssetReadPolicy(
  base: BaseSchoolService,
  purpose: SchoolIssuanceAssetPurpose,
  attachment?: Attachment,
): Promise<AttachmentReadPolicy> {
  return {
    purpose,
    readScope: async (): Promise<ResourceAccessScope> => {
      if (!await isAllowlistedPublicBranding(base, purpose, attachment))
        await assertIssuanceAssetAuthority(base, purpose)
      return issuanceAssetScope(base.actor.schoolId, purpose, attachment ? [attachment.id] : undefined)
    },
  }
}

export async function schoolIssuanceAssetUploadPolicy(
  base: BaseSchoolService,
  purpose: SchoolIssuanceAssetPurpose,
  schoolId: string,
): Promise<AttachmentUploadPolicy> {
  return {
    purpose,
    allowedMimeTypes: IMAGE_TYPES,
    maxBytes: SCHOOL_ISSUANCE_ASSET_MAX_BYTES,
    assertSave: async (attachment: Attachment, existing: Attachment | undefined) => {
      if (attachment.ownerKind !== AttachmentOwnerKind.School || attachment.ownerId !== schoolId || attachment.schoolId !== schoolId)
        denyResourceAccess()
      await base.access.documents.assertConfigureIssuanceAssets()
      await validateAttachmentSave(attachment, existing, base.repositories)
      return issuanceAssetScope(schoolId, purpose)
    },
  }
}
