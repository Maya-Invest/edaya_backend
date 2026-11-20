import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AttachmentsSeedPort } from '../port'
import { AttachmentStatus } from '@edaya/core'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityList } from '../../../transport/http/core-entity'

export interface CreateHttpAttachmentsSeedPortOptions {
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

export function createHttpAttachmentsSeedPort(
  options: CreateHttpAttachmentsSeedPortOptions,
): AttachmentsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-attachments-seed',
  }

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      const existing = await postEntityList(requestOptions, 'attachments', { id: record.id, $limit: 1 }) as { id: string, schoolId: string, ownerId: string, ownerKind: string, status: string }[]
      if (existing[0]?.status === AttachmentStatus.Ready && existing[0].schoolId === record.schoolId
        && existing[0].ownerId === record.ownerId && existing[0].ownerKind === record.ownerKind) {
        return
      }
      const { response, body } = await options.client.jsonRequest<UploadIntentResponse>(
        '/core/files/upload-intents',
        {
          method: 'POST',
          headers: coreHeaders(options.serviceAccountApiKey, 'http-attachments-upload'),
          body: JSON.stringify({
            attachmentId: record.id,
            ownerKind: record.ownerKind,
            ownerId: record.ownerId,
            fileName: record.fileName,
            mimeType: record.mimeType,
            sizeBytes: record.body.byteLength,
          }),
        },
      )
      if (!response.ok || !body) {
        throw new Error(`create-attachment-upload failed with status ${response.status}`)
      }
      const uploadResponse = await options.client.request(body.uploadUrl, {
        method: 'PUT',
        headers: body.headers ?? { 'Content-Type': record.mimeType! },
        body: record.body,
      })
      if (!uploadResponse.ok) {
        const detail = (await uploadResponse.text()).trim().slice(0, 300)
        throw new Error(
          `attachment upload failed with status ${uploadResponse.status}${detail ? `: ${detail}` : ''}`,
        )
      }
      await postCoreCommand(requestOptions, 'registerAttachment', {
        id: body.attachmentId,
        schoolId: record.schoolId,
        ownerKind: record.ownerKind,
        ownerId: record.ownerId,
        fileName: record.fileName,
        storageKey: body.storageKey,
        status: AttachmentStatus.Ready,
        mimeType: record.mimeType,
        sizeBytes: record.body.byteLength,
        uploadedById: record.uploadedById,
      })
    }),
  }
}
