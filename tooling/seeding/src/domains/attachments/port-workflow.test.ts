import type { AttachmentSeedRecord, AttachmentsSeedPort } from './port'
import { AttachmentOwnerKind } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevAttachments } from './workflow'

describe('attachments seed port workflow', () => {
  test('maps polymorphic owners and serializes creation dates', async () => {
    const attachments: AttachmentSeedRecord[] = []
    const port: AttachmentsSeedPort = {
      saveAttachment: async record => void attachments.push(record),
    }

    const counts = await seedDevAttachments(port, demoCiDataset)

    expect(counts).toEqual({ attachments: demoCiDataset.entities.attachments?.length ?? 0 })
    expect(attachments.map(record => record.ownerKind)).toContain(AttachmentOwnerKind.Incident)
    expect(attachments.map(record => record.ownerKind))
      .toContain(AttachmentOwnerKind.StudentDisciplinaryAction)
    expect(attachments[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
