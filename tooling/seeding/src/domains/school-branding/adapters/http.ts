import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { SchoolBrandingSeedPort } from '../port'
import { AttachmentStatus } from '@edaya/core'
import { schoolIssuanceAssetSlot } from '@edaya/service'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById } from '../../../transport/http/core-entity'

export interface CreateHttpSchoolBrandingSeedPortOptions {
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

export function createHttpSchoolBrandingSeedPort(
  options: CreateHttpSchoolBrandingSeedPortOptions,
): SchoolBrandingSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-school-branding-seed',
  }

  return {
    updateIssuingIdentity: record => withSeedPortError('schoolBranding.updateIssuingIdentity', async () => {
      await postCoreCommand(requestOptions, 'updateSchoolConfiguration', {
        schoolId: record.schoolId,
        issuingName: record.issuingName ?? null,
        postalAddress: record.postalAddress ?? null,
        phone: record.phone ?? null,
        email: record.email ?? null,
        schoolCode: record.schoolCode ?? null,
        publicBrandingPurposes: [...record.publicBrandingPurposes],
      })
    }),
    uploadIssuanceAsset: input => withSeedPortError('schoolBranding.uploadIssuanceAsset', async () => {
      const school = await postEntityFindById(requestOptions, 'schools', input.schoolId) as {
        logoAttachmentId?: string
        crestAttachmentId?: string
        stampAttachmentId?: string
        signatureAttachmentId?: string
      } | undefined
      const slot = schoolIssuanceAssetSlot(input.purpose)
      if (school?.[slot] === input.attachmentId)
        return
      const { response, body } = await options.client.jsonRequest<UploadIntentResponse>(
        '/core/commands/create-school-issuance-asset-upload',
        {
          method: 'POST',
          headers: coreHeaders(options.serviceAccountApiKey, 'http-school-branding-upload'),
          body: JSON.stringify({
            purpose: input.purpose,
            attachmentId: input.attachmentId,
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
          }),
        },
      )
      if (!response.ok || !body)
        throw new Error(`create-school-issuance-asset-upload failed with status ${response.status}`)
      const uploadResponse = await options.client.request(body.uploadUrl, {
        method: 'PUT',
        headers: body.headers ?? { 'Content-Type': input.mimeType },
        body: input.body,
      })
      if (!uploadResponse.ok) {
        const detail = (await uploadResponse.text()).trim().slice(0, 300)
        throw new Error(
          `issuance asset upload failed with status ${uploadResponse.status}${detail ? `: ${detail}` : ''}`,
        )
      }
      await postCoreCommand(requestOptions, 'completeSchoolIssuanceAssetUpload', {
        id: body.attachmentId,
        schoolId: input.schoolId,
        ownerKind: 'school',
        ownerId: input.schoolId,
        fileName: input.fileName,
        storageKey: body.storageKey,
        status: AttachmentStatus.Ready,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        purpose: input.purpose,
      })
    }),
  }
}
