import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../../utils/validation'

export enum AnnouncementAudience {
  School = 'school',
  Staff = 'staff',
  Guardians = 'guardians',
  Students = 'students',
  ClassGroup = 'class_group',
  Custom = 'custom',
}

export enum AnnouncementStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

export enum AnnouncementPriority {
  Normal = 'normal',
  Important = 'important',
  Urgent = 'urgent',
}

export interface AnnouncementArgs {
  id: string
  schoolId: string
  title: string
  content: string
  audience: AnnouncementAudience
  classGroupId?: string
  createdBy?: string
  status?: AnnouncementStatus
  priority?: AnnouncementPriority
  premiumNotification?: boolean
  createdAt?: Date
  publishedAt?: Date
  expiresAt?: Date | null
}

/**
 * Represents a communication or notice broadcasted to the school or a specific class group.
 * Can trigger standard or premium notifications for guardians and staff.
 */
export class Announcement {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly content: string
  readonly audience: AnnouncementAudience
  readonly classGroupId?: string
  readonly createdBy?: string
  readonly status: AnnouncementStatus
  readonly priority: AnnouncementPriority
  readonly premiumNotification: boolean
  readonly createdAt: Date
  readonly publishedAt?: Date
  readonly expiresAt?: Date

  constructor({
    id,
    schoolId,
    title,
    content,
    audience,
    classGroupId,
    createdBy,
    status,
    priority = AnnouncementPriority.Normal,
    premiumNotification = false,
    createdAt,
    publishedAt,
    expiresAt,
  }: AnnouncementArgs) {
    if (audience === AnnouncementAudience.ClassGroup && !classGroupId) {
      throw new Error('classGroupId is required for class group announcements')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.content = requireNonBlank(content, 'content')
    this.audience = audience
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.createdBy = requireOptionalNonBlank(createdBy, 'createdBy')
    this.status = status ?? (publishedAt ? AnnouncementStatus.Published : AnnouncementStatus.Draft)
    this.priority = priority
    this.premiumNotification = premiumNotification
    this.createdAt = createdAt ?? new Date()
    this.publishedAt = publishedAt ? requireValidDate(publishedAt, 'publishedAt') : undefined
    this.expiresAt = expiresAt ? requireValidDate(expiresAt, 'expiresAt') : undefined

    if (this.status === AnnouncementStatus.Published && !this.publishedAt) {
      throw new Error('publishedAt is required for published announcements')
    }
    if (this.status === AnnouncementStatus.Draft && this.publishedAt) {
      throw new Error('draft announcements must not define publishedAt')
    }
    if (this.expiresAt && this.publishedAt && this.expiresAt.getTime() < this.publishedAt.getTime()) {
      throw new Error('expiresAt must not be before publishedAt')
    }
  }

  get isPublished(): boolean {
    return this.status === AnnouncementStatus.Published
  }

  isVisibleForClassGroup(currentClassGroupId: string): boolean {
    return this.audience === AnnouncementAudience.School || this.classGroupId === currentClassGroupId
  }
}
