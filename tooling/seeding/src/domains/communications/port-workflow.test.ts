import type {
  AnnouncementSeedRecord,
  AnnouncementTargetSeedRecord,
  CommunicationsSeedPort,
  MessageDeliverySeedRecord,
  PublishAnnouncementSeedRecord,
} from './port'
import { AnnouncementStatus, AnnouncementTargetKind, MessageDeliveryStatus } from '@edaya/core'
import { demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevCommunications } from './workflow'

describe('communications seed port workflow', () => {
  test('seeds targets before publication and counts materialized plus explicit deliveries', async () => {
    const announcements = demoDataset.entities.announcements ?? []
    const targets = demoDataset.entities.announcementTargets ?? []
    const explicitDeliveries = demoDataset.entities.messageDeliveries ?? []
    const materializePlans = demoDataset.extensions?.announcementMaterializePlans ?? []
    const announcementRecords: AnnouncementSeedRecord[] = []
    const targetRecords: AnnouncementTargetSeedRecord[] = []
    const published: PublishAnnouncementSeedRecord[] = []
    const deliveries: MessageDeliverySeedRecord[] = []
    const materializedCount = 3
    const port: CommunicationsSeedPort = {
      createAnnouncement: async record => void announcementRecords.push(record),
      addTarget: async record => void targetRecords.push(record),
      publishAnnouncement: async record => void published.push(record),
      materializeDeliveries: async () => materializedCount,
      recordDelivery: async record => void deliveries.push(record),
    }

    const counts = await seedDevCommunications(port, demoDataset)

    expect(counts).toEqual({
      announcements: announcements.length,
      announcementTargets: targets.length,
      messageDeliveries: materializePlans.length * materializedCount + explicitDeliveries.length,
    })
    expect(announcementRecords.map(record => record.status)).toContain(AnnouncementStatus.Draft)
    expect(targetRecords.map(record => record.targetKind)).toContain(AnnouncementTargetKind.ClassGroup)
    expect(published).toHaveLength(
      announcements.filter(record => record.status === AnnouncementStatus.Published).length,
    )
    expect(deliveries.map(record => record.status)).toContain(MessageDeliveryStatus.Read)
    expect(deliveries.find(record => record.sentAt)?.sentAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
  })
})
