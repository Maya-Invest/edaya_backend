import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { ProfilePicturesSeedPort } from '../port'
import { AttachmentStatus, parseAttachmentIdFromContentUrl } from '@edaya/core'
import { buildAttachmentContentUrl } from '@edaya/service'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById, postEntitySave } from '../../../transport/http/core-entity'

export interface CreateHttpProfilePicturesSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

interface UploadIntentResponse {
  attachmentId: string
  storageKey: string
  uploadUrl: string
  headers?: Record<string, string>
}

function coreHeaders(serviceAccountApiKey: string | undefined, requestId?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(serviceAccountApiKey ? { authorization: `Bearer ${serviceAccountApiKey}` } : {}),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  }
}

export function createHttpProfilePicturesSeedPort(
  options: CreateHttpProfilePicturesSeedPortOptions,
): ProfilePicturesSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-profile-pictures-seed',
  }

  return {
    uploadProfilePhoto: input => withSeedPortError('profilePictures.uploadProfilePhoto', async () => {
      const existing = await postEntityFindById(requestOptions, 'attachments', input.attachmentId).catch(() => undefined) as {
        id: string
        schoolId: string
        ownerId: string
        ownerKind: string
        status: string
      } | undefined
      if (existing?.status === AttachmentStatus.Ready && existing.schoolId === input.schoolId
        && existing.ownerId === input.ownerId && existing.ownerKind === input.ownerKind) {
        return { attachmentId: existing.id, photoUrl: buildAttachmentContentUrl(options.client.origin, existing.id) }
      }
      const { response, body } = await options.client.jsonRequest<UploadIntentResponse>(
        '/core/commands/create-profile-photo-upload',
        {
          method: 'POST',
          headers: coreHeaders(options.serviceAccountApiKey, 'http-profile-pictures-upload'),
          body: JSON.stringify({
            attachmentId: input.attachmentId,
            ownerKind: input.ownerKind,
            ownerId: input.ownerId,
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          }),
        },
      )

      if (response.status === 409) {
        return {
          attachmentId: input.attachmentId,
          photoUrl: buildAttachmentContentUrl(options.client.origin, input.attachmentId),
        }
      }

      if (!response.ok || !body) {
        throw new Error(`create-profile-photo-upload failed with status ${response.status}`)
      }

      const uploadResponse = await options.client.request(body.uploadUrl, {
        method: 'PUT',
        headers: body.headers ?? { 'Content-Type': input.mimeType },
        body: input.body,
      })
      if (!uploadResponse.ok) {
        const detail = (await uploadResponse.text()).trim().slice(0, 300)
        throw new Error(
          `profile photo upload failed with status ${uploadResponse.status}${detail ? `: ${detail}` : ''}`,
        )
      }

      await postCoreCommand(requestOptions, 'completeProfilePhotoUpload', {
        id: body.attachmentId,
        schoolId: input.schoolId,
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        fileName: input.fileName,
        storageKey: body.storageKey,
        status: AttachmentStatus.Ready,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedById: input.uploadedById,
      })

      return {
        attachmentId: body.attachmentId,
        photoUrl: buildAttachmentContentUrl(options.client.origin, body.attachmentId),
      }
    }),
    setStudentPhotoUrl: (studentId, photoUrl) => withSeedPortError('profilePictures.setStudentPhotoUrl', async () => {
      const attachmentId = parseAttachmentIdFromContentUrl(photoUrl)
      if (!attachmentId)
        throw new Error('Portrait URL must be a private content projection')
      await postCoreCommand(requestOptions, 'publishStudentPhoto', {
        requestId: `seed-publish-student-photo-${studentId}`,
        studentId,
        attachmentId,
      })
    }),
    setGuardianPhotoUrl: (guardianId, photoUrl) => withSeedPortError('profilePictures.setGuardianPhotoUrl', async () => {
      await postCoreCommand(requestOptions, 'updateGuardianProfile', { guardianId, photoUrl })
    }),
    setStaffPhotoUrl: (staffId, photoUrl) => withSeedPortError('profilePictures.setStaffPhotoUrl', async () => {
      await postCoreCommand(requestOptions, 'updateStaffMemberProfile', { staffId, photoUrl })
    }),
    setTeacherPhotoUrl: (teacherId, photoUrl) => withSeedPortError('profilePictures.setTeacherPhotoUrl', async () => {
      const teacher = await postEntityFindById(requestOptions, 'teachers', teacherId)
      if (!teacher || typeof teacher !== 'object')
        throw new Error(`Teacher ${teacherId} not found`)
      await postEntitySave(requestOptions, 'teachers', { ...teacher, photoUrl })
    }),
  }
}
