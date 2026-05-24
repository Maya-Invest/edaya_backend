import type { AnnouncementAudience, AnnouncementPriority } from '$lib/core/entities/messaging/announcement'
import type { AnnouncementTargetKind } from '$lib/core/entities/messaging/announcement-target'
import type {
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
} from '$lib/core/entities/messaging/message-delivery'
import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { AnnouncementTargetRepository } from '$lib/core/ports/announcement-target-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { MessageDeliveryRepository } from '$lib/core/ports/message-delivery-repository'
import { Announcement, AnnouncementStatus } from '$lib/core/entities/messaging/announcement'
import { AnnouncementTarget } from '$lib/core/entities/messaging/announcement-target'
import { MessageDelivery } from '$lib/core/entities/messaging/message-delivery'

export interface CommunicationsServiceArgs {
  classGroupRepository: ClassGroupRepository
  announcementRepository: AnnouncementRepository
  announcementTargetRepository: AnnouncementTargetRepository
  messageDeliveryRepository: MessageDeliveryRepository
}

export class CommunicationsService {
  constructor(args: CommunicationsServiceArgs) {
    this.classGroups = args.classGroupRepository
    this.announcements = args.announcementRepository
    this.targets = args.announcementTargetRepository
    this.deliveries = args.messageDeliveryRepository
  }

  private readonly classGroups: ClassGroupRepository
  private readonly announcements: AnnouncementRepository
  private readonly targets: AnnouncementTargetRepository
  private readonly deliveries: MessageDeliveryRepository

  async createAnnouncement({
    id,
    schoolId,
    title,
    content,
    audience,
    classGroupId,
    createdBy,
    priority,
    premiumNotification,
    createdAt,
    expiresAt,
  }: {
    id: string
    schoolId: string
    title: string
    content: string
    audience: AnnouncementAudience
    classGroupId?: string
    createdBy?: string
    priority?: AnnouncementPriority
    premiumNotification?: boolean
    createdAt?: Date
    expiresAt?: Date
  }): Promise<Announcement> {
    await this.validateClassGroupAudience({ audience, classGroupId, schoolId })
    const announcement = new Announcement({
      id,
      schoolId,
      title,
      content,
      audience,
      classGroupId,
      createdBy,
      priority,
      premiumNotification,
      status: AnnouncementStatus.Draft,
      createdAt,
      expiresAt,
    })
    await this.announcements.save(announcement)
    return announcement
  }

  async addTarget({
    id,
    announcementId,
    targetKind,
    targetId,
    createdAt,
  }: {
    id: string
    announcementId: string
    targetKind: AnnouncementTargetKind
    targetId: string
    createdAt?: Date
  }): Promise<AnnouncementTarget> {
    await this.requireAnnouncement(announcementId)
    const target = new AnnouncementTarget({ id, announcementId, targetKind, targetId, createdAt })
    await this.targets.save(target)
    return target
  }

  async publishAnnouncement({
    announcementId,
    publishedAt,
  }: {
    announcementId: string
    publishedAt?: Date
  }): Promise<Announcement> {
    const existing = await this.requireAnnouncement(announcementId)
    const announcement = new Announcement({
      id: existing.id,
      schoolId: existing.schoolId,
      title: existing.title,
      content: existing.content,
      audience: existing.audience,
      classGroupId: existing.classGroupId,
      createdBy: existing.createdBy,
      priority: existing.priority,
      premiumNotification: existing.premiumNotification,
      status: AnnouncementStatus.Published,
      createdAt: existing.createdAt,
      publishedAt: publishedAt ?? new Date(),
      expiresAt: existing.expiresAt,
    })
    await this.announcements.save(announcement)
    return announcement
  }

  async recordDelivery({
    id,
    announcementId,
    recipientKind,
    recipientId,
    channel,
    status,
    providerMessageId,
    failureReason,
    sentAt,
    readAt,
    createdAt,
    updatedAt,
  }: {
    id: string
    announcementId: string
    recipientKind: MessageDeliveryRecipientKind
    recipientId: string
    channel: MessageDeliveryChannel
    status?: MessageDeliveryStatus
    providerMessageId?: string
    failureReason?: string
    sentAt?: Date
    readAt?: Date
    createdAt?: Date
    updatedAt?: Date
  }): Promise<MessageDelivery> {
    const announcement = await this.requireAnnouncement(announcementId)
    if (!announcement.isPublished) {
      throw new Error(`Announcement ${announcementId} must be published before recording delivery`)
    }
    const delivery = new MessageDelivery({
      id,
      announcementId,
      recipientKind,
      recipientId,
      channel,
      status,
      providerMessageId,
      failureReason,
      sentAt,
      readAt,
      createdAt,
      updatedAt,
    })
    await this.deliveries.save(delivery)
    return delivery
  }

  private async validateClassGroupAudience({
    audience,
    classGroupId,
    schoolId,
  }: {
    audience: AnnouncementAudience
    classGroupId?: string
    schoolId: string
  }): Promise<void> {
    if (audience !== 'class_group') {
      return
    }
    const classGroup = classGroupId ? await this.classGroups.findById(classGroupId) : undefined
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    if (classGroup.schoolId !== schoolId) {
      throw new Error(`ClassGroup ${classGroupId} does not belong to school ${schoolId}`)
    }
  }

  private async requireAnnouncement(announcementId: string): Promise<Announcement> {
    const announcement = await this.announcements.findById(announcementId)
    if (!announcement) {
      throw new Error(`Unknown announcement: ${announcementId}`)
    }
    return announcement
  }
}
