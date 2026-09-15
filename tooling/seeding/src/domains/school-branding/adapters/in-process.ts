import type { SeedApplication } from '../../../support/types'
import type { SchoolBrandingSeedPort, UploadSchoolIssuanceAssetInput } from '../port'
import { createSystemActorMetadata } from '@edaya/authorization'
import { AttachmentOwnerKind, AttachmentStatus } from '@edaya/core'
import { completeSchoolIssuanceAssetUpload, createSchoolIssuanceAssetUpload, schoolIssuanceAssetSlot } from '@edaya/service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessSchoolBrandingSeedPort(
  application: SeedApplication,
): SchoolBrandingSeedPort {
  function serviceFor(schoolId: string) {
    return application.forActor(createSystemActorMetadata({
      schoolId,
      requestId: 'dev-school-branding-seed',
      systemId: 'fixture-seed',
      reason: 'Install the selected local development dataset',
    }))
  }

  return {
    updateIssuingIdentity: record => withSeedPortError('schoolBranding.updateIssuingIdentity', async () => {
      await serviceFor(record.schoolId).setupWorkflow.updateSchoolConfiguration({
        schoolId: record.schoolId,
        issuingName: record.issuingName,
        postalAddress: record.postalAddress,
        phone: record.phone,
        email: record.email,
        schoolCode: record.schoolCode,
        publicBrandingPurposes: [...record.publicBrandingPurposes],
      })
    }),
    uploadIssuanceAsset: input => withSeedPortError('schoolBranding.uploadIssuanceAsset', async () => {
      await uploadIssuanceAssetInProcess(application, input)
    }),
  }
}

async function uploadIssuanceAssetInProcess(
  application: SeedApplication,
  input: UploadSchoolIssuanceAssetInput,
): Promise<void> {
  const service = application.forActor(createSystemActorMetadata({
    schoolId: input.schoolId,
    requestId: 'dev-school-branding-seed',
    systemId: 'fixture-seed',
    reason: 'Install the selected local development dataset',
  }))
  const slot = schoolIssuanceAssetSlot(input.purpose)
  const school = await service.baseService.entities.schools.findById(input.schoolId)
  if (school?.[slot] === input.attachmentId) {
    const existing = await service.baseService.entities.attachments.findById(input.attachmentId)
    if (existing?.status === AttachmentStatus.Ready && existing.purpose === input.purpose)
      return
  }
  const intent = await createSchoolIssuanceAssetUpload(service.baseService, {
    purpose: input.purpose,
    attachmentId: input.attachmentId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  })
  await service.baseService.fileStorage.putObject({
    key: intent.storageKey,
    body: input.body,
    contentType: input.mimeType,
  })
  await completeSchoolIssuanceAssetUpload(service.baseService, {
    id: intent.attachmentId,
    schoolId: input.schoolId,
    ownerKind: AttachmentOwnerKind.School,
    ownerId: input.schoolId,
    fileName: input.fileName,
    storageKey: intent.storageKey,
    status: AttachmentStatus.Ready,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    purpose: input.purpose,
  })
}
