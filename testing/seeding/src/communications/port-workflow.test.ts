import type {
  AnnouncementSeedRecord,
  AnnouncementTargetSeedRecord,
  CommunicationsSeedPort,
  MessageDeliverySeedRecord,
  PublishAnnouncementSeedRecord,
} from './port'
import { AnnouncementStatus, AnnouncementTargetKind, MessageDeliveryStatus } from '@edaya/core'
import {
  SEED_ANNOUNCEMENT_MATERIALIZE_PLANS,
  SEED_ANNOUNCEMENT_TARGETS,
  SEED_ANNOUNCEMENTS,
  SEED_MESSAGE_DELIVERIES,
} from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevCommunications } from './workflow'

describe('communications seed port workflow', () => {
  test('seeds targets before publication and counts materialized plus explicit deliveries', async () => {
    const announcements: AnnouncementSeedRecord[] = []
    const targets: AnnouncementTargetSeedRecord[] = []
    const published: PublishAnnouncementSeedRecord[] = []
    const deliveries: MessageDeliverySeedRecord[] = []
    const materializedCount = 3
    const port: CommunicationsSeedPort = {
      createAnnouncement: async record => void announcements.push(record),
      addTarget: async record => void targets.push(record),
      publishAnnouncement: async record => void published.push(record),
      materializeDeliveries: async () => materializedCount,
      recordDelivery: async record => void deliveries.push(record),
    }

    const counts = await seedDevCommunications(port)

    expect(counts).toEqual({
      announcements: SEED_ANNOUNCEMENTS.length,
      announcementTargets: SEED_ANNOUNCEMENT_TARGETS.length,
      messageDeliveries:
        SEED_ANNOUNCEMENT_MATERIALIZE_PLANS.length * materializedCount
        + SEED_MESSAGE_DELIVERIES.length,
    })
    expect(announcements.map(record => record.status)).toContain(AnnouncementStatus.Draft)
    expect(targets.map(record => record.targetKind)).toContain(AnnouncementTargetKind.ClassGroup)
    expect(published).toHaveLength(SEED_ANNOUNCEMENTS.filter(record => record.status === 'published').length)
    expect(deliveries.map(record => record.status)).toContain(MessageDeliveryStatus.Read)
    expect(deliveries.find(record => record.sentAt)?.sentAt)
      .toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
  })
})
