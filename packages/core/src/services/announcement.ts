import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import { Announcement, AnnouncementAudience } from '$lib/core/entities/templates/announcement'

export interface AnnouncementServiceArgs {
  classroomRepository: ClassroomRepository
  announcementRepository: AnnouncementRepository
}

export class AnnouncementService {
  constructor(args: AnnouncementServiceArgs) {
    this.classrooms = args.classroomRepository
    this.announcements = args.announcementRepository
  }

  private readonly classrooms: ClassroomRepository
  private readonly announcements: AnnouncementRepository

  async publishAnnouncement({
    id,
    schoolId,
    title,
    content,
    audience,
    classroomId,
    createdBy,
    premiumNotification = false,
    publishedAt,
  }: {
    id: string
    schoolId: string
    title: string
    content: string
    audience: AnnouncementAudience
    classroomId?: string
    createdBy?: string
    premiumNotification?: boolean
    publishedAt?: Date
  }): Promise<Announcement> {
    if (audience === AnnouncementAudience.Classroom) {
      const classroom = classroomId ? await this.classrooms.findById(classroomId) : undefined
      if (!classroom) {
        throw new Error(`Unknown classroom: ${classroomId}`)
      }
      if (classroom.schoolId !== schoolId) {
        throw new Error(`Classroom ${classroomId} does not belong to school ${schoolId}`)
      }
    }

    const announcement = new Announcement({
      id,
      schoolId,
      title,
      content,
      audience,
      classroomId,
      createdBy,
      premiumNotification,
      publishedAt: publishedAt ?? new Date(),
    })
    await this.announcements.save(announcement)
    return announcement
  }

  async listAnnouncementsForStudent({
    schoolId,
    classroomId,
  }: {
    schoolId: string
    classroomId: string
  }): Promise<Announcement[]> {
    const announcements = await this.announcements.listBySchool(schoolId)
    return announcements
      .filter(announcement => announcement.isPublished)
      .filter(announcement => announcement.isVisibleForClassroom(classroomId))
      .sort((left, right) => {
        const leftDate = left.publishedAt ?? left.createdAt
        const rightDate = right.publishedAt ?? right.createdAt
        return rightDate.getTime() - leftDate.getTime()
      })
  }
}
