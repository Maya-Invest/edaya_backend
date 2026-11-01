import type { SeedApplication } from '../../../support/types'
import type { AttachmentsSeedPort } from '../port'
import { AttachmentStatus } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload } from '@edaya/service'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAttachmentsSeedPort(
  application: SeedApplication,
): AttachmentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-attachments-seed')

  return {
    saveAttachment: record => withSeedPortError('attachments.saveAttachment', async () => {
      const existing = await service.baseService.entities.attachments.findById(record.id)
      if (existing && existing.status === AttachmentStatus.Ready && existing.schoolId === record.schoolId
        && existing.ownerId === record.ownerId && existing.ownerKind === record.ownerKind) {
        return
      }
      const { storageKey } = await createAttachmentUpload(service.baseService, {
        attachmentId: record.id,
        ownerKind: record.ownerKind,
        ownerId: record.ownerId,
        fileName: record.fileName,
        mimeType: record.mimeType!,
        sizeBytes: record.body.byteLength,
      })
      await service.baseService.fileStorage.putObject({
        key: storageKey,
        body: record.body,
        contentType: record.mimeType!,
      })
      await completeAttachmentUpload(service.baseService, {
        id: record.id,
        schoolId: record.schoolId,
        ownerKind: record.ownerKind,
        ownerId: record.ownerId,
        fileName: record.fileName,
        storageKey,
        status: AttachmentStatus.Ready,
        mimeType: record.mimeType,
        sizeBytes: record.body.byteLength,
        uploadedById: record.uploadedById,
      })
    }),
  }
}
