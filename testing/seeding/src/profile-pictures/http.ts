import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { ProfilePicturesSeedPort } from './port'
import { AttachmentStatus, buildSeedProfilePhotoUrl } from '@edaya/core'
import { postCoreCommand } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

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
      const { response, body } = await options.client.jsonRequest<UploadIntentResponse>(
        '/core/files/upload-intents',
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

      if (!response.ok || !body) {
        throw new Error(`upload-intents failed with status ${response.status}`)
      }

      const uploadResponse = await options.client.request(body.uploadUrl, {
        method: 'PUT',
        headers: body.headers ?? { 'content-type': input.mimeType },
        body: input.body,
      })
      if (!uploadResponse.ok) {
        throw new Error(`profile photo upload failed with status ${uploadResponse.status}`)
      }

      await postCoreCommand(requestOptions, 'registerAttachment', {
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
        photoUrl: buildSeedProfilePhotoUrl(options.client.origin, body.attachmentId),
      }
    }),
    setStudentPhotoUrl: (studentId, photoUrl) => withSeedPortError('profilePictures.setStudentPhotoUrl', async () => {
      await postCoreCommand(requestOptions, 'updateStudentProfile', { studentId, photoUrl })
    }),
    setGuardianPhotoUrl: (guardianId, photoUrl) => withSeedPortError('profilePictures.setGuardianPhotoUrl', async () => {
      await postCoreCommand(requestOptions, 'updateGuardianContactMethods', { guardianId, photoUrl })
    }),
    setStaffPhotoUrl: (staffId, photoUrl) => withSeedPortError('profilePictures.setStaffPhotoUrl', async () => {
      await postCoreCommand(requestOptions, 'updateStaffMemberProfile', { staffId, photoUrl })
    }),
  }
}
