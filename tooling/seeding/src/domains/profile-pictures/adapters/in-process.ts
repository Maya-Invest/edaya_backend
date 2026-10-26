import type { Attachment } from '@edaya/core'
import type { SeedApplication } from '../../../support/types'
import type { ProfilePicturesSeedPort, UploadProfilePhotoInput } from '../port'
import { AttachmentStatus, parseAttachmentIdFromContentUrl } from '@edaya/core'
import { buildAttachmentContentUrl, completeProfilePhotoUpload, createProfilePhotoUpload } from '@edaya/service'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

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
        photoUrl: buildAttachmentContentUrl(options.apiBaseUrl, uploaded.id),
      }
    }),
    setStudentPhotoUrl: (studentId, photoUrl) => withSeedPortError('profilePictures.setStudentPhotoUrl', async () => {
      const attachmentId = parseAttachmentIdFromContentUrl(photoUrl)
      if (!attachmentId)
        throw new Error('Portrait URL must be a private content projection')
      await service.studentWorkflow.publishStudentPhoto({
        requestId: `seed-publish-student-photo-${studentId}`,
        studentId,
        attachmentId,
      })
    }),
    setGuardianPhotoUrl: (guardianId, photoUrl) => withSeedPortError('profilePictures.setGuardianPhotoUrl', async () => {
      await service.studentWorkflow.updateGuardianProfile({ guardianId, photoUrl })
    }),
    setStaffPhotoUrl: (staffId, photoUrl) => withSeedPortError('profilePictures.setStaffPhotoUrl', async () => {
      await service.setupWorkflow.updateStaffMemberProfile({ staffId, photoUrl })
    }),
    setTeacherPhotoUrl: (teacherId, photoUrl) => withSeedPortError('profilePictures.setTeacherPhotoUrl', async () => {
      const teacher = await service.baseService.entities.teachers.findById(teacherId)
      if (!teacher)
        throw new Error(`Teacher ${teacherId} not found`)
      await service.baseService.entities.teachers.save(teacher.copyWith({ photoUrl }))
    }),
  }
}

async function uploadProfilePhotoInProcess(
  service: ReturnType<typeof createInProcessSeedService>,
  input: UploadProfilePhotoInput,
): Promise<Attachment> {
  const existing = await service.baseService.entities.attachments.findById(input.attachmentId)
  if (existing && existing.status === AttachmentStatus.Ready && existing.schoolId === input.schoolId
    && existing.ownerId === input.ownerId && existing.ownerKind === input.ownerKind) {
    return existing
  }
  const { storageKey } = await createProfilePhotoUpload(service.baseService, {
    attachmentId: input.attachmentId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  })

  await service.baseService.fileStorage.putObject({
    key: storageKey,
    body: input.body,
    contentType: input.mimeType,
  })

  return completeProfilePhotoUpload(service.baseService, {
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
