import { requireNonBlank } from '../../utils/validation'

export enum AnnouncementAudience {
  School = 'school',
  Classroom = 'classroom',
  Staff = 'staff',
  Guardian = 'guardian',
  Student = 'student',
}

export interface AnnouncementArgs {
  id: string
  schoolId: string
  title: string
  content: string
  audience: AnnouncementAudience
  classroomId?: string
  createdBy?: string
  premiumNotification?: boolean
  createdAt?: Date
  publishedAt?: Date
}

/**
 * Represents a communication or notice broadcasted to the school or a specific classroom.
 * Can trigger standard or premium notifications for guardians and staff.
 */
export class Announcement {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly content: string
  readonly audience: AnnouncementAudience
  readonly classroomId?: string
  readonly createdBy?: string
  readonly premiumNotification: boolean
  readonly createdAt: Date
  readonly publishedAt?: Date

  constructor({
    id,
    schoolId,
    title,
    content,
    audience,
    classroomId,
    createdBy,
    premiumNotification = false,
    createdAt,
    publishedAt,
  }: AnnouncementArgs) {
    if (audience === AnnouncementAudience.Classroom && !classroomId) {
      throw new Error('classroomId is required for classroom announcements')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.content = requireNonBlank(content, 'content')
    this.audience = audience
    this.classroomId = classroomId
    this.createdBy = createdBy
    this.premiumNotification = premiumNotification
    this.createdAt = createdAt ?? new Date()
    this.publishedAt = publishedAt
  }

  get isPublished(): boolean {
    return this.publishedAt != null
  }

  isVisibleForClassroom(currentClassroomId: string): boolean {
    return this.audience === AnnouncementAudience.School || this.classroomId === currentClassroomId
  }
}
