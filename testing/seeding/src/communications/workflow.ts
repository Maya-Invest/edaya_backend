import type { CommunicationsSeedPort } from './port'
import {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTargetKind,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
} from '@edaya/core'
import {
  SEED_ANNOUNCEMENT_MATERIALIZE_PLANS,
  SEED_ANNOUNCEMENT_TARGETS,
  SEED_ANNOUNCEMENTS,
  SEED_MESSAGE_DELIVERIES,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const ANNOUNCEMENT_STATUS_BY_SEED = {
  draft: AnnouncementStatus.Draft,
  published: AnnouncementStatus.Published,
  archived: AnnouncementStatus.Archived,
} as const

const ANNOUNCEMENT_PRIORITY_BY_SEED = {
  normal: AnnouncementPriority.Normal,
  important: AnnouncementPriority.Important,
  urgent: AnnouncementPriority.Urgent,
} as const

const ANNOUNCEMENT_TARGET_KIND_BY_SEED = {
  school: AnnouncementTargetKind.School,
  all_staff: AnnouncementTargetKind.AllStaff,
  all_guardians: AnnouncementTargetKind.AllGuardians,
  all_students: AnnouncementTargetKind.AllStudents,
  class_group: AnnouncementTargetKind.ClassGroup,
  grade_level: AnnouncementTargetKind.GradeLevel,
  staff_member: AnnouncementTargetKind.StaffMember,
  guardian: AnnouncementTargetKind.Guardian,
  student: AnnouncementTargetKind.Student,
} as const

const DELIVERY_CHANNEL_BY_SEED = {
  app: MessageDeliveryChannel.App,
  email: MessageDeliveryChannel.Email,
  sms: MessageDeliveryChannel.Sms,
  whatsapp: MessageDeliveryChannel.WhatsApp,
  other: MessageDeliveryChannel.Other,
} as const

const RECIPIENT_KIND_BY_SEED = {
  staff: MessageDeliveryRecipientKind.Staff,
  guardian: MessageDeliveryRecipientKind.Guardian,
  student: MessageDeliveryRecipientKind.Student,
} as const

const DELIVERY_STATUS_BY_SEED = {
  pending: MessageDeliveryStatus.Pending,
  sent: MessageDeliveryStatus.Sent,
  failed: MessageDeliveryStatus.Failed,
  read: MessageDeliveryStatus.Read,
  cancelled: MessageDeliveryStatus.Cancelled,
} as const

function seedDateAndMinute(timestamp: string): string {
  return `${timestamp.slice(0, 16)}:00.000Z`
}

export interface DevCommunicationsSeedCounts {
  announcements: number
  announcementTargets: number
  messageDeliveries: number
}

export async function seedDevCommunications(
  port: CommunicationsSeedPort,
): Promise<DevCommunicationsSeedCounts> {
  for (const announcement of SEED_ANNOUNCEMENTS) {
    await port.createAnnouncement({
      id: announcement.id,
      schoolId: announcement.schoolId,
      title: announcement.title,
      content: announcement.content,
      createdBy: announcement.createdBy,
      status: ANNOUNCEMENT_STATUS_BY_SEED[announcement.status],
      priority: ANNOUNCEMENT_PRIORITY_BY_SEED[announcement.priority ?? 'normal'],
      premiumNotification: announcement.premiumNotification ?? false,
      createdAt: seedDateTime(announcement.createdAt),
      publishedAt: announcement.publishedAt ? seedDateTime(announcement.publishedAt) : undefined,
      expiresAt: announcement.expiresAt ? seedDateTime(announcement.expiresAt) : undefined,
    })
  }

  for (const target of SEED_ANNOUNCEMENT_TARGETS) {
    await port.addTarget({
      id: target.id,
      announcementId: target.announcementId,
      targetKind: ANNOUNCEMENT_TARGET_KIND_BY_SEED[target.targetKind],
      targetId: target.targetId,
    })
  }

  for (const announcement of SEED_ANNOUNCEMENTS) {
    if (announcement.status === 'published') {
      await port.publishAnnouncement({
        announcementId: announcement.id,
        publishedAt: announcement.publishedAt ? seedDateTime(announcement.publishedAt) : undefined,
      })
    }
  }

  let messageDeliveryCount = 0
  for (const plan of SEED_ANNOUNCEMENT_MATERIALIZE_PLANS) {
    messageDeliveryCount += await port.materializeDeliveries({
      announcementId: plan.announcementId,
      channel: DELIVERY_CHANNEL_BY_SEED[plan.channel],
    })
  }

  for (const delivery of SEED_MESSAGE_DELIVERIES) {
    await port.recordDelivery({
      id: delivery.id,
      announcementId: delivery.announcementId,
      recipientKind: RECIPIENT_KIND_BY_SEED[delivery.recipientKind],
      recipientId: delivery.recipientId,
      channel: DELIVERY_CHANNEL_BY_SEED[delivery.channel],
      status: DELIVERY_STATUS_BY_SEED[delivery.status],
      sentAt: delivery.sentAt ? seedDateAndMinute(delivery.sentAt) : undefined,
      readAt: delivery.readAt ? seedDateAndMinute(delivery.readAt) : undefined,
      failureReason: delivery.failureReason,
    })
    messageDeliveryCount += 1
  }

  return {
    announcements: SEED_ANNOUNCEMENTS.length,
    announcementTargets: SEED_ANNOUNCEMENT_TARGETS.length,
    messageDeliveries: messageDeliveryCount,
  }
}
