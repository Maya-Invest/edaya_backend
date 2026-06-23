import type { SeedApplication } from '../types'
import type { AttachmentsSeedPort } from './port'
import { Attachment } from '@edaya/core'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessAttachmentsSeedPort(
  application: SeedApplication,
): AttachmentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-attachments-seed')

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      await service.baseService.entities.attachments.save(new Attachment({
        ...record,
        createdAt: new Date(record.createdAt),
      }), { moduleChecked: true })
    }),
  }
}
