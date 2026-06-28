import type { SeedApplication } from '../types'
import type { ProfilePicturesSeedPort, UploadProfilePhotoInput } from './port'
import {
  Attachment,
  AttachmentStatus,
  buildSeedProfilePhotoUrl,
} from '@edaya/core'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export interface CreateInProcessProfilePicturesSeedPortOptions {
  application: SeedApplication
  apiBaseUrl: string
}

export function createInProcessProfilePicturesSeedPort(
  options: CreateInProcessProfilePicturesSeedPortOptions,
): ProfilePicturesSeedPort {
  const service = createInProcessSeedService(options.application, 'dev-profile-pictures-seed')

  return {
    uploadProfilePhoto: input => withSeedPortError('profilePictures.uploadProfilePhoto', async () => {
      const uploaded = await uploadProfilePhotoInProcess(service, input)
      return {
        attachmentId: uploaded.id,
        photoUrl: buildSeedProfilePhotoUrl(options.apiBaseUrl, uploaded.id),
      }
    }),
    setStudentPhotoUrl: (studentId, photoUrl) => withSeedPortError('profilePictures.setStudentPhotoUrl', async () => {
      await service.studentWorkflow.updateStudentProfile({ studentId, photoUrl })
    }),
    setGuardianPhotoUrl: (guardianId, photoUrl) => withSeedPortError('profilePictures.setGuardianPhotoUrl', async () => {
      await service.studentWorkflow.updateGuardianContactMethods({ guardianId, photoUrl })
    }),
    setStaffPhotoUrl: (staffId, photoUrl) => withSeedPortError('profilePictures.setStaffPhotoUrl', async () => {
      await service.setupWorkflow.updateStaffMemberProfile({ staffId, photoUrl })
    }),
  }
}

async function uploadProfilePhotoInProcess(
  service: ReturnType<typeof createInProcessSeedService>,
  input: UploadProfilePhotoInput,
): Promise<Attachment> {
  const storageKey = [
    input.schoolId,
    'uploads',
    input.ownerKind,
    input.ownerId,
    input.attachmentId,
    input.fileName,
  ].join('/')

  await service.baseService.fileStorage.putObject({
    key: storageKey,
    body: input.body,
    contentType: input.mimeType,
  })

  return service.setupWorkflow.registerAttachment({
    id: input.attachmentId,
    schoolId: input.schoolId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    fileName: input.fileName,
    storageKey,
    status: AttachmentStatus.Ready,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedById: input.uploadedById,
  })
}
