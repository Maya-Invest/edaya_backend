import type { FixtureDataset } from '@edaya/fixtures'
import type { CommunicationsSeedPort } from './port'
import { AnnouncementPriority, AnnouncementStatus, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export function seedDateAndMinute(timestamp: string): string {
  return `${timestamp.slice(0, 16)}:00.000Z`
}

export interface DevCommunicationsSeedCounts {
  announcements: number
  announcementTargets: number
  messageDeliveries: number
}

export async function seedDevCommunications(
  port: CommunicationsSeedPort,
  dataset: FixtureDataset,
): Promise<DevCommunicationsSeedCounts> {
  const announcements = dataset.entities.announcements ?? []
  const announcementTargets = dataset.entities.announcementTargets ?? []
  const announcementMaterializePlans = dataset.extensions?.announcementMaterializePlans ?? []
  const messageDeliveries = dataset.entities.messageDeliveries ?? []

  for (const announcement of announcements) {
    const status = announcement.status
      ?? (announcement.publishedAt ? AnnouncementStatus.Published : AnnouncementStatus.Draft)
    await port.createAnnouncement({
      id: announcement.id,
      schoolId: announcement.schoolId,
      title: announcement.title,
      content: announcement.content,
      createdBy: announcement.createdBy ?? '',
      status,
      priority: announcement.priority ?? AnnouncementPriority.Normal,
      createdAt: seedDateTime(String(announcement.createdAt).slice(0, 10)),
      publishedAt: announcement.publishedAt ? seedDateTime(String(announcement.publishedAt).slice(0, 10)) : undefined,
      expiresAt: announcement.expiresAt ? seedDateTime(String(announcement.expiresAt).slice(0, 10)) : undefined,
    })
  }

  for (const target of announcementTargets) {
    await port.addTarget({
      id: target.id,
      announcementId: target.announcementId,
      targetKind: target.targetKind,
      targetId: target.targetId ?? undefined,
    })
  }

  for (const announcement of announcements) {
    const status = announcement.status
      ?? (announcement.publishedAt ? AnnouncementStatus.Published : AnnouncementStatus.Draft)
    if (status === AnnouncementStatus.Published) {
      await port.publishAnnouncement({
        announcementId: announcement.id,
        publishedAt: announcement.publishedAt ? seedDateTime(String(announcement.publishedAt).slice(0, 10)) : undefined,
      })
    }
  }

  let messageDeliveryCount = 0
  for (const plan of announcementMaterializePlans) {
    messageDeliveryCount += await port.materializeDeliveries({
      announcementId: plan.announcementId,
    })
  }

  for (const delivery of messageDeliveries) {
    await port.recordDelivery({
      id: delivery.id,
      schoolId: delivery.schoolId,
      title: delivery.title,
      body: delivery.body,
      announcementId: delivery.announcementId ?? '',
      subjectId: delivery.subjectId,
      recipientKind: delivery.recipientKind ?? MessageDeliveryRecipientKind.Guardian,
      recipientId: delivery.recipientId ?? '',
      status: delivery.status ?? MessageDeliveryStatus.Pending,
      sentAt: delivery.sentAt ? seedDateAndMinute(String(delivery.sentAt)) : undefined,
      readAt: delivery.readAt ? seedDateAndMinute(String(delivery.readAt)) : undefined,
      failureReason: delivery.failureReason ?? undefined,
    })
    messageDeliveryCount += 1
  }

  return {
    announcements: announcements.length,
    announcementTargets: announcementTargets.length,
    messageDeliveries: messageDeliveryCount,
  }
}
