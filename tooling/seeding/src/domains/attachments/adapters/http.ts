import type { HttpSeedClient } from '../../../transport/http/client'
import type { AttachmentsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { createHttpProfilePicturesSeedPort } from '../../profile-pictures/adapters/http'

export interface CreateHttpAttachmentsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAttachmentsSeedPort(
  options: CreateHttpAttachmentsSeedPortOptions,
): AttachmentsSeedPort {
  const uploads = createHttpProfilePicturesSeedPort(options)

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      await uploads.uploadProfilePhoto({ ...record, attachmentId: record.id, mimeType: record.mimeType!, sizeBytes: record.body.byteLength })
    }),
  }
}
