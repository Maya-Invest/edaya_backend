import type { AnnouncementPriority, AnnouncementStatus, AnnouncementTargetKind, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '@edaya/core'

export interface AnnouncementSeedRecord {
  id: string
  schoolId: string
  title: string
  content: string
  createdBy: string
  status: AnnouncementStatus
  priority: AnnouncementPriority
  createdAt: string
  publishedAt?: string
  expiresAt?: string
}

export interface AnnouncementTargetSeedRecord {
  id: string
  announcementId: string
  targetKind: AnnouncementTargetKind
  targetId?: string
}

export interface PublishAnnouncementSeedRecord {
  announcementId: string
  publishedAt?: string
}

export interface MaterializeDeliveriesSeedRecord {
  announcementId: string
}

export interface MessageDeliverySeedRecord {
  id: string
  schoolId: string
  title: string
  body: string
  announcementId: string
  subjectId: string
  recipientKind: MessageDeliveryRecipientKind
  recipientId: string
  status: MessageDeliveryStatus
  sentAt?: string
  readAt?: string
  failureReason?: string
}

export interface CommunicationsSeedPort {
  findRecipientSubjectId: (kind: MessageDeliveryRecipientKind, id: string) => Promise<string | undefined>
  createAnnouncement: (record: AnnouncementSeedRecord) => Promise<void>
  addTarget: (record: AnnouncementTargetSeedRecord) => Promise<void>
  publishAnnouncement: (record: PublishAnnouncementSeedRecord) => Promise<void>
  materializeDeliveries: (record: MaterializeDeliveriesSeedRecord) => Promise<number>
  recordDelivery: (record: MessageDeliverySeedRecord) => Promise<void>
}
