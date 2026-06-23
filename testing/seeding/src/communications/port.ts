import type {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTargetKind,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
} from '@edaya/core'

export interface AnnouncementSeedRecord {
  id: string
  schoolId: string
  title: string
  content: string
  createdBy: string
  status: AnnouncementStatus
  priority: AnnouncementPriority
  premiumNotification: boolean
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
  channel: MessageDeliveryChannel
}

export interface MessageDeliverySeedRecord {
  id: string
  announcementId: string
  recipientKind: MessageDeliveryRecipientKind
  recipientId: string
  channel: MessageDeliveryChannel
  status: MessageDeliveryStatus
  sentAt?: string
  readAt?: string
  failureReason?: string
}

export interface CommunicationsSeedPort {
  createAnnouncement: (record: AnnouncementSeedRecord) => Promise<void>
  addTarget: (record: AnnouncementTargetSeedRecord) => Promise<void>
  publishAnnouncement: (record: PublishAnnouncementSeedRecord) => Promise<void>
  materializeDeliveries: (record: MaterializeDeliveriesSeedRecord) => Promise<number>
  recordDelivery: (record: MessageDeliverySeedRecord) => Promise<void>
}
