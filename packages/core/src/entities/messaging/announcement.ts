import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

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
  createdBy?: string
  status?: AnnouncementStatus
  priority?: AnnouncementPriority
  premiumNotification?: boolean
  createdAt?: Date
  publishedAt?: Date
  expiresAt?: Date | null
}

/**
 * Represents publishable communication content; target records define its audience.
 * Can trigger standard or premium notifications for guardians and staff.
 */
export class Announcement {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly content: string
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
    createdBy,
    status,
    priority = AnnouncementPriority.Normal,
    premiumNotification = false,
    createdAt,
    publishedAt,
    expiresAt,
  }: AnnouncementArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.content = requireNonBlank(content, 'content')
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

  get effectiveDate(): Date {
    return this.publishedAt ?? this.createdAt
  }
}
