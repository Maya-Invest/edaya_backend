import type { SeedApplication } from '../../../support/types'
import type { AttachmentsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { createInProcessProfilePicturesSeedPort } from '../../profile-pictures/adapters/in-process'

export function createInProcessAttachmentsSeedPort(
  application: SeedApplication,
): AttachmentsSeedPort {
  const uploads = createInProcessProfilePicturesSeedPort({ application, apiBaseUrl: 'http://localhost:9999' })

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      await uploads.uploadProfilePhoto({ ...record, attachmentId: record.id, mimeType: record.mimeType!, sizeBytes: record.body.byteLength })
    }),
  }
}
