import type { FixtureDataset } from '@edaya/fixtures'
import type { AttachmentsSeedPort } from './port'
import { readFile } from 'node:fs/promises'
import { AttachmentOwnerKind } from '@edaya/core'
import { resolveAttachmentFixturePath } from '@edaya/fixtures/shared/attachment-assets'
import { seedDateTime } from '../../support/seed-date'

function shouldSeedAttachment(
  attachment: NonNullable<FixtureDataset['entities']['attachments']>[number],
  dataset: FixtureDataset,
): boolean {
  if (
    dataset.extensions?.skipLessonSessionSeeding
    && attachment.ownerKind === AttachmentOwnerKind.AttendanceRecord
  ) {
    return false
  }

  return true
}

export async function seedDevAttachments(
  port: AttachmentsSeedPort,
  dataset: FixtureDataset,
): Promise<{ attachments: number }> {
  const attachments = (dataset.entities.attachments ?? []).filter(attachment =>
    shouldSeedAttachment(attachment, dataset))

  for (const attachment of attachments) {
    const body = new Uint8Array(await readFile(resolveAttachmentFixturePath(attachment.mimeType!)))
    await port.saveAttachment({
      id: attachment.id,
      schoolId: attachment.schoolId,
      ownerKind: attachment.ownerKind,
      ownerId: attachment.ownerId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl ?? '',
      mimeType: attachment.mimeType ?? undefined,
      sizeBytes: body.byteLength,
      body,
      uploadedById: attachment.uploadedById ?? undefined,
      createdAt: seedDateTime(String(attachment.createdAt).slice(0, 10)),
    })
  }

  return { attachments: attachments.length }
}
