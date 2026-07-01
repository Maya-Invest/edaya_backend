import type { FixtureDataset } from '@edaya/fixtures'
import type { AttachmentsSeedPort } from './port'
import { seedDateTime } from '../../support/seed-date'

export async function seedDevAttachments(
  port: AttachmentsSeedPort,
  dataset: FixtureDataset,
): Promise<{ attachments: number }> {
  const attachments = dataset.entities.attachments ?? []

  for (const attachment of attachments) {
    await port.saveAttachment({
      id: attachment.id,
      schoolId: attachment.schoolId,
      ownerKind: attachment.ownerKind,
      ownerId: attachment.ownerId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl ?? '',
      mimeType: attachment.mimeType ?? undefined,
      sizeBytes: attachment.sizeBytes ?? undefined,
      uploadedById: attachment.uploadedById ?? undefined,
      createdAt: seedDateTime(String(attachment.createdAt).slice(0, 10)),
    })
  }

  return { attachments: attachments.length }
}
