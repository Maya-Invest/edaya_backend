import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

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

export const announcementBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  content: z.string().trim().min(1, 'content must not be blank'),
  createdBy: z.string().trim().min(1, 'createdBy must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(AnnouncementStatus).optional(),
  priority: z.nativeEnum(AnnouncementPriority).default(AnnouncementPriority.Normal),
  createdAt: zodDate().default(() => new Date()),
  publishedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  expiresAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function refineAnnouncement(data: any, ctx: z.RefinementCtx) {
  const computedStatus = data.status ?? (data.publishedAt ? AnnouncementStatus.Published : AnnouncementStatus.Draft)
  if (computedStatus === AnnouncementStatus.Published && !data.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'publishedAt is required for published announcements',
    })
  }
  if (computedStatus === AnnouncementStatus.Draft && data.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'draft announcements must not define publishedAt',
    })
  }
  if (data.expiresAt && data.publishedAt && startOfUtcDay(data.expiresAt) < startOfUtcDay(data.publishedAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'expiresAt must not be before publishedAt',
    })
  }
}

export const announcementSchema = announcementBaseSchema.superRefine(refineAnnouncement)

export type AnnouncementData = z.infer<typeof announcementSchema>
export type AnnouncementInput = z.input<typeof announcementSchema>

export const announcementCreateSchema = announcementBaseSchema.omit({ createdAt: true }).superRefine(refineAnnouncement)
export const announcementUpdateSchema = announcementBaseSchema.partial().required({ id: true }).superRefine(refineAnnouncement)

/**
 * Represents publishable communication content; target records define its audience.
 * Can trigger standard or premium notifications for guardians and staff.
 */
export class Announcement {
  readonly data: AnnouncementData

  constructor(args: AnnouncementInput) {
    this.data = parseDomain(announcementSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get title() { return this.data.title }
  get content() { return this.data.content }
  get createdBy() { return this.data.createdBy }
  get status(): AnnouncementStatus {
    return this.data.status ?? (this.data.publishedAt ? AnnouncementStatus.Published : AnnouncementStatus.Draft)
  }

  get priority() { return this.data.priority }
  get createdAt() { return this.data.createdAt }
  get publishedAt() { return this.data.publishedAt }
  get expiresAt() { return this.data.expiresAt }

  get isPublished(): boolean {
    return this.status === AnnouncementStatus.Published
  }

  get effectiveDate(): Date {
    return this.publishedAt ?? this.createdAt
  }
}

export const announcementConfig: EntityConfigFactory<Announcement> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.announcements,
    Permission.QUERY_COMMUNICATIONS_READ,
    Permission.COMMUNICATION_CREATE,
  )
  return {
    ...config,
    gates: {
      preDelete: validateAnnouncementDelete,
    },
  }
}

async function validateAnnouncementDelete(
  announcement: Announcement,
  repositories: SchoolRepositories,
): Promise<void> {
  const [targets, deliveries] = await Promise.all([
    repositories.announcementTargets.list({ announcementId: announcement.id }),
    repositories.messageDeliveries.list({ announcementId: announcement.id }),
  ])
  if (targets.length > 0 || deliveries.length > 0) {
    throw new BusinessRuleViolationError('ANNOUNCEMENT_HAS_DEPENDENCIES', `Cannot delete announcement ${announcement.id}: dependent records still exist`)
  }
}
