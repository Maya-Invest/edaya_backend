import type { AnnouncementAudience, AnnouncementPriority } from '../../entities/messaging/announcement'
import type { AnnouncementTargetKind } from '../../entities/messaging/announcement-target'
import type {
  MessageDeliveryChannel,
  MessageDeliveryStatus,
} from '../../entities/messaging/message-delivery'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Announcement, AnnouncementStatus } from '../../entities/messaging/announcement'
import { AnnouncementTarget, AnnouncementTargetKind as TargetKind } from '../../entities/messaging/announcement-target'
import { MessageDelivery, MessageDeliveryRecipientKind } from '../../entities/messaging/message-delivery'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'

export class CommunicationsService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.classGroups = args.repositories.classGroups
    this.gradeLevels = args.repositories.gradeLevels
    this.staffMembers = args.repositories.staffMembers
    this.guardians = args.repositories.guardians
    this.students = args.repositories.students
    this.announcements = args.repositories.announcements
    this.targets = args.repositories.announcementTargets
    this.deliveries = args.repositories.messageDeliveries
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly students: SchoolRepositories['students']
  private readonly announcements: SchoolRepositories['announcements']
  private readonly targets: SchoolRepositories['announcementTargets']
  private readonly deliveries: SchoolRepositories['messageDeliveries']
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  async createAnnouncement({
    id,
    schoolId,
    title,
    content,
    audience,
    classGroupId,
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
    priority?: AnnouncementPriority
    premiumNotification?: boolean
    createdAt?: Date
    expiresAt?: Date
  }): Promise<Announcement> {
    await this.authorize({ schoolId, classGroupId })
    await this.validateClassGroupAudience({ audience, classGroupId, schoolId })
    const announcement = new Announcement({
      id,
      schoolId,
      title,
      content,
      audience,
      classGroupId,
      createdBy: resolveAuditActorId(this.actor),
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
    const announcement = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    await this.requireTargetInSchool(targetKind, targetId, announcement.schoolId)
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
    await this.authorize({ schoolId: existing.schoolId, announcementId })
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
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    await this.requireRecipientInSchool(recipientKind, recipientId, announcement.schoolId)
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
    if (!classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireAnnouncement(announcementId: string): Promise<Announcement> {
    const announcement = await this.announcements.findById(announcementId)
    if (!announcement) {
      denyResourceAccess()
    }
    return announcement
  }

  private async requireTargetInSchool(
    targetKind: AnnouncementTargetKind,
    targetId: string,
    schoolId: string,
  ): Promise<void> {
    switch (targetKind) {
      case TargetKind.ClassGroup:
        await this.requireOwnedResource(this.classGroups.findById(targetId), 'ClassGroup', targetId, schoolId)
        return
      case TargetKind.GradeLevel:
        await this.requireOwnedResource(this.gradeLevels.findById(targetId), 'Grade level', targetId, schoolId)
        return
      case TargetKind.Staff:
        await this.requireOwnedResource(this.staffMembers.findById(targetId), 'Staff member', targetId, schoolId)
        return
      case TargetKind.Guardian:
        await this.requireOwnedResource(this.guardians.findById(targetId), 'Guardian', targetId, schoolId)
        return
      case TargetKind.Student:
        await this.requireOwnedResource(this.students.findById(targetId), 'Student', targetId, schoolId)
    }
  }

  private async requireRecipientInSchool(
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
    schoolId: string,
  ): Promise<void> {
    switch (recipientKind) {
      case MessageDeliveryRecipientKind.Staff:
        await this.requireOwnedResource(this.staffMembers.findById(recipientId), 'Staff member', recipientId, schoolId)
        return
      case MessageDeliveryRecipientKind.Guardian:
        await this.requireOwnedResource(this.guardians.findById(recipientId), 'Guardian', recipientId, schoolId)
        return
      case MessageDeliveryRecipientKind.Student:
        await this.requireOwnedResource(this.students.findById(recipientId), 'Student', recipientId, schoolId)
    }
  }

  private async requireOwnedResource(
    resourcePromise: Promise<{ schoolId: string } | undefined>,
    _resourceName: string,
    _resourceId: string,
    schoolId: string,
  ): Promise<void> {
    const resource = await resourcePromise
    if (!resource || resource.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async authorize(resource: {
    schoolId: string
    classGroupId?: string
    announcementId?: string
  }): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'communications.manage',
      resource,
    })
  }
}
