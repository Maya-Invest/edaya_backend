import type { SchoolService } from '@edaya/core'
import {
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTargetKind,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
} from '@edaya/core'
import {
  countSeedAnnouncements,
  countSeedAnnouncementTargets,
  parseSeedDate,
  parseSeedDateTime,
  SEED_ANNOUNCEMENT_MATERIALIZE_PLANS,
  SEED_ANNOUNCEMENT_TARGETS,
  SEED_ANNOUNCEMENTS,
  SEED_MESSAGE_DELIVERIES,
} from '@edaya/dev-fixtures'

const announcementStatusBySeed = {
  draft: AnnouncementStatus.Draft,
  published: AnnouncementStatus.Published,
  archived: AnnouncementStatus.Archived,
} as const

const announcementPriorityBySeed = {
  normal: AnnouncementPriority.Normal,
  important: AnnouncementPriority.Important,
  urgent: AnnouncementPriority.Urgent,
} as const

const announcementTargetKindBySeed = {
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

const messageDeliveryChannelBySeed = {
  app: MessageDeliveryChannel.App,
  email: MessageDeliveryChannel.Email,
  sms: MessageDeliveryChannel.Sms,
  whatsapp: MessageDeliveryChannel.WhatsApp,
  other: MessageDeliveryChannel.Other,
} as const

const messageDeliveryRecipientKindBySeed = {
  staff: MessageDeliveryRecipientKind.Staff,
  guardian: MessageDeliveryRecipientKind.Guardian,
  student: MessageDeliveryRecipientKind.Student,
} as const

const messageDeliveryStatusBySeed = {
  pending: MessageDeliveryStatus.Pending,
  sent: MessageDeliveryStatus.Sent,
  failed: MessageDeliveryStatus.Failed,
  read: MessageDeliveryStatus.Read,
  cancelled: MessageDeliveryStatus.Cancelled,
} as const

export async function seedCommunications(service: SchoolService): Promise<{
  announcements: number
  announcementTargets: number
  messageDeliveries: number
}> {
  for (const announcement of SEED_ANNOUNCEMENTS) {
    await service.createAnnouncement({
      id: announcement.id,
      schoolId: announcement.schoolId,
      title: announcement.title,
      content: announcement.content,
      createdBy: announcement.createdBy,
      status: announcementStatusBySeed[announcement.status],
      priority: announcementPriorityBySeed[announcement.priority ?? 'normal'],
      premiumNotification: announcement.premiumNotification ?? false,
      createdAt: parseSeedDate(announcement.createdAt),
      publishedAt: announcement.publishedAt ? parseSeedDate(announcement.publishedAt) : undefined,
      expiresAt: announcement.expiresAt ? parseSeedDate(announcement.expiresAt) : undefined,
    })
  }

  for (const target of SEED_ANNOUNCEMENT_TARGETS) {
    await service.addTarget({
      id: target.id,
      announcementId: target.announcementId,
      targetKind: announcementTargetKindBySeed[target.targetKind],
      targetId: target.targetId,
    })
  }

  for (const announcement of SEED_ANNOUNCEMENTS) {
    if (announcement.status !== 'published') {
      continue
    }
    await service.publishAnnouncement({
      announcementId: announcement.id,
      publishedAt: announcement.publishedAt ? parseSeedDate(announcement.publishedAt) : undefined,
    })
  }

  let messageDeliveryCount = 0

  for (const plan of SEED_ANNOUNCEMENT_MATERIALIZE_PLANS) {
    const deliveries = await service.materializeDeliveries({
      announcementId: plan.announcementId,
      channel: messageDeliveryChannelBySeed[plan.channel],
    })
    messageDeliveryCount += deliveries.length
  }

  for (const delivery of SEED_MESSAGE_DELIVERIES) {
    await service.recordDelivery({
      id: delivery.id,
      announcementId: delivery.announcementId,
      recipientKind: messageDeliveryRecipientKindBySeed[delivery.recipientKind],
      recipientId: delivery.recipientId,
      channel: messageDeliveryChannelBySeed[delivery.channel],
      status: messageDeliveryStatusBySeed[delivery.status],
      sentAt: delivery.sentAt ? parseSeedDateTime(delivery.sentAt.slice(0, 10), delivery.sentAt.slice(11, 16)) : undefined,
      readAt: delivery.readAt ? parseSeedDateTime(delivery.readAt.slice(0, 10), delivery.readAt.slice(11, 16)) : undefined,
      failureReason: delivery.failureReason,
    })
    messageDeliveryCount += 1
  }

  return {
    announcements: countSeedAnnouncements(),
    announcementTargets: countSeedAnnouncementTargets(),
    messageDeliveries: messageDeliveryCount,
  }
}
