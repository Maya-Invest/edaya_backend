import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { ProfilePicturesSeedPort } from '../port'
import { AttachmentStatus, parseAttachmentIdFromContentUrl, profilePhotoPurposeForOwner } from '@edaya/core'
import { buildAttachmentContentUrl } from '@edaya/service'
import { ApiError } from '@maya-invest/edaya-api-client'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById, postEntitySave } from '../../../transport/http/core-entity'
import { createSeedSchoolClient } from '../../../transport/http/school-client'
import { retryPhotoOperation } from './retry'

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

const recoverableUploadConflicts = new Set(['ATTACHMENT_UPLOAD_EXPIRED', 'ATTACHMENT_UPLOAD_CONFLICT', 'ATTACHMENT_ALREADY_COMPLETED', 'ATTACHMENT_ALREADY_EXISTS', 'COMMAND_REPLAY_CONFLICT'])
const ownerEntities = { student: 'students', guardian: 'guardians', staff: 'staffMembers', teacher: 'teachers' } as const

export function createHttpProfilePicturesSeedPort(
  options: CreateHttpProfilePicturesSeedPortOptions,
): ProfilePicturesSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-profile-pictures-seed',
  }
  const api = createSeedSchoolClient(options.client, requestOptions)

  return {
    uploadProfilePhoto: input => withSeedPortError('profilePictures.uploadProfilePhoto', async () => {
      const entity = ownerEntities[input.ownerKind as keyof typeof ownerEntities]
      if (!entity)
        throw new Error('Unsupported portrait owner')
      const owner = await retryPhotoOperation(() => api.entities[entity].get(input.ownerId)) as { photoUrl?: string } | undefined
      const publishedId = parseAttachmentIdFromContentUrl(owner?.photoUrl ?? '')
      // Owner projections only publish admitted portraits. Reuse our previous
      // recovery identity too, without requiring a separate private-attachment grant.
      if (publishedId && (publishedId === input.attachmentId || publishedId.startsWith(`${input.attachmentId}-retry-`)))
        return { attachmentId: publishedId, photoUrl: buildAttachmentContentUrl(options.client.origin, publishedId) }

      const findReady = async (id: string) => {
        let existing: {
          id: string
          schoolId: string
          ownerId: string
          ownerKind: string
          status: string
          purpose: string
        } | undefined
        try {
          existing = await retryPhotoOperation(() => api.entities.attachments.get(id)) as typeof existing
        }
        catch (error) {
          if (!(error instanceof ApiError) || ![403, 404].includes(error.status))
            throw error
        }
        return existing?.status === AttachmentStatus.Ready && existing.schoolId === input.schoolId
          && existing.ownerId === input.ownerId && existing.ownerKind === input.ownerKind
          && existing.purpose === profilePhotoPurposeForOwner(input.ownerKind)
          ? { attachmentId: existing.id, photoUrl: buildAttachmentContentUrl(options.client.origin, existing.id) }
          : undefined
      }
      const existing = await findReady(input.attachmentId)
      if (existing)
        return existing
      const create = (attachmentId: string) => retryPhotoOperation(() => api.commands.createProfilePhotoUpload({
        attachmentId,
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      }) as Promise<UploadIntentResponse>)
      let body: UploadIntentResponse
      try {
        body = await create(input.attachmentId)
      }
      catch (error) {
        const code = error instanceof ApiError && error.body && typeof error.body === 'object' && 'code' in error.body ? String(error.body.code) : ''
        if (!(error instanceof ApiError) || error.status !== 409 || !recoverableUploadConflicts.has(code))
          throw error
        const completed = await findReady(input.attachmentId)
        if (completed)
          return completed
        // Expired/legacy intents cannot change metadata. Authorize a fresh upload,
        // and publish it only after PUT and completion both succeed.
        body = await create(`${input.attachmentId}-retry-${crypto.randomUUID()}`)
      }

      await retryPhotoOperation(async () => {
        const response = await options.client.request(body.uploadUrl, {
          method: 'PUT',
          headers: body.headers ?? { 'Content-Type': input.mimeType },
          body: input.body,
        })
        if (!response.ok) {
          await response.body?.cancel()
          throw new ApiError(response.status, { message: 'Profile photo upload failed' })
        }
      })

      await retryPhotoOperation(() => api.commands.completeProfilePhotoUpload({
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
      }))

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
        requestId: `seed-publish-student-photo-${studentId}-${attachmentId}`,
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
