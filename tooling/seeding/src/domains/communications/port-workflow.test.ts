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
      findRecipientSubjectId: async (_kind, id) => `central-${id}`,
      createAnnouncement: async record => void announcementRecords.push(record),
      addTarget: async record => void targetRecords.push(record),
      publishAnnouncement: async (record) => {
        expect(targetRecords.some(target => target.announcementId === record.announcementId)).toBe(true)
        published.push(record)
      },
      materializeDeliveries: async () => materializedCount,
      recordDelivery: async record => void deliveries.push(record),
    }

    const counts = await seedDevCommunications(port, demoDataset)

    expect(counts).toEqual({
      announcements: announcements.length,
      announcementTargets: targets.length,
      messageDeliveries: materializePlans.length * materializedCount + explicitDeliveries.length,
    })
    expect(announcementRecords.every(record => record.status !== AnnouncementStatus.Published && record.publishedAt === undefined)).toBe(true)
    expect(deliveries.every(record => record.subjectId === `central-${record.recipientId}`)).toBe(true)
    expect(targetRecords.map(record => record.targetKind)).toContain(AnnouncementTargetKind.ClassGroup)
    expect(published).toHaveLength(
      announcements.filter(record => record.status === AnnouncementStatus.Published).length,
    )
    expect(deliveries.map(record => record.status)).toContain(MessageDeliveryStatus.Read)
    expect(deliveries.find(record => record.sentAt)?.sentAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
  })
  test('does not create deliveries for profiles without a current identity link', async () => {
    const port: CommunicationsSeedPort = {
      findRecipientSubjectId: async () => undefined,
      createAnnouncement: async () => {},
      addTarget: async () => {},
      publishAnnouncement: async () => {},
      materializeDeliveries: async () => 0,
      recordDelivery: async () => { throw new Error('Unlinked profile must not receive a delivery') },
    }
    expect((await seedDevCommunications(port, demoDataset)).messageDeliveries).toBe(0)
  })
})
