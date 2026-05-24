import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import { Announcement, AnnouncementAudience } from '$lib/core/entities/messaging/announcement'

export interface AnnouncementServiceArgs {
  classGroupRepository: ClassGroupRepository
  announcementRepository: AnnouncementRepository
}

export class AnnouncementService {
  constructor(args: AnnouncementServiceArgs) {
    this.classGroups = args.classGroupRepository
    this.announcements = args.announcementRepository
  }

  private readonly classGroups: ClassGroupRepository
  private readonly announcements: AnnouncementRepository

  async publishAnnouncement({
    id,
    schoolId,
    title,
    content,
    audience,
    classGroupId,
    createdBy,
    premiumNotification = false,
    publishedAt,
  }: {
    id: string
    schoolId: string
    title: string
    content: string
    audience: AnnouncementAudience
    classGroupId?: string
    createdBy?: string
    premiumNotification?: boolean
    publishedAt?: Date
  }): Promise<Announcement> {
    if (audience === AnnouncementAudience.ClassGroup) {
      const classGroup = classGroupId ? await this.classGroups.findById(classGroupId) : undefined
      if (!classGroup) {
        throw new Error(`Unknown classGroup: ${classGroupId}`)
      }
      if (classGroup.schoolId !== schoolId) {
        throw new Error(`ClassGroup ${classGroupId} does not belong to school ${schoolId}`)
      }
    }

    const announcement = new Announcement({
      id,
      schoolId,
      title,
      content,
      audience,
      classGroupId,
      createdBy,
      premiumNotification,
      publishedAt: publishedAt ?? new Date(),
    })
    await this.announcements.save(announcement)
    return announcement
  }

  async listAnnouncementsForStudent({
    schoolId,
    classGroupId,
  }: {
    schoolId: string
    classGroupId: string
  }): Promise<Announcement[]> {
    const announcements = await this.announcements.listBySchool(schoolId)
    return announcements
      .filter(announcement => announcement.isPublished)
      .filter(announcement => announcement.isVisibleForClassGroup(classGroupId))
      .sort((left, right) => {
        const leftDate = left.publishedAt ?? left.createdAt
        const rightDate = right.publishedAt ?? right.createdAt
        return rightDate.getTime() - leftDate.getTime()
      })
  }
}
