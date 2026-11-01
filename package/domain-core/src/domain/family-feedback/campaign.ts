import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import { FAMILY_FEEDBACK_QUESTION_VERSION } from './catalog'

export enum FamilyFeedbackCampaignStatus {
  Draft = 'draft',
  Scheduled = 'scheduled',
  Open = 'open',
  Closed = 'closed',
  Published = 'published',
  Archived = 'archived',
  Cancelled = 'cancelled',
}

export const familyFeedbackCampaignSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  academicPeriodId: z.string().trim().min(1, 'academicPeriodId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  teacherAssignmentId: z.string().trim().min(1, 'teacherAssignmentId must not be blank'),
  teacherId: z.string().trim().min(1, 'teacherId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  questionVersion: z.literal(FAMILY_FEEDBACK_QUESTION_VERSION).default(FAMILY_FEEDBACK_QUESTION_VERSION),
  status: z.nativeEnum(FamilyFeedbackCampaignStatus).default(FamilyFeedbackCampaignStatus.Draft),
  opensAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  closesAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  openedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  closedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  publishedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  archivedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  answersPurgedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  moderatorStaffId: z.string().trim().min(1, 'moderatorStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  themeDraft: z.string().trim().min(1, 'themeDraft must not be blank').max(8000).nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

export type FamilyFeedbackCampaignData = z.infer<typeof familyFeedbackCampaignSchema>
export type FamilyFeedbackCampaignInput = z.input<typeof familyFeedbackCampaignSchema>

export class FamilyFeedbackCampaign {
  readonly data: FamilyFeedbackCampaignData

  constructor(args: FamilyFeedbackCampaignInput) {
    this.data = parseDomain(familyFeedbackCampaignSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get academicPeriodId() { return this.data.academicPeriodId }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get teacherAssignmentId() { return this.data.teacherAssignmentId }
  get teacherId() { return this.data.teacherId }
  get subjectId() { return this.data.subjectId }
  get questionVersion() { return this.data.questionVersion }
  get status() { return this.data.status }
  get opensAt() { return this.data.opensAt }
  get closesAt() { return this.data.closesAt }
  get openedAt() { return this.data.openedAt }
  get closedAt() { return this.data.closedAt }
  get cancelledAt() { return this.data.cancelledAt }
  get publishedAt() { return this.data.publishedAt }
  get archivedAt() { return this.data.archivedAt }
  get answersPurgedAt() { return this.data.answersPurgedAt }
  get moderatorStaffId() { return this.data.moderatorStaffId }
  get themeDraft() { return this.data.themeDraft }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get isMutable() {
    return this.status === FamilyFeedbackCampaignStatus.Draft || this.status === FamilyFeedbackCampaignStatus.Scheduled
  }

  get isCancellable() {
    return this.status === FamilyFeedbackCampaignStatus.Draft
      || this.status === FamilyFeedbackCampaignStatus.Scheduled
      || this.status === FamilyFeedbackCampaignStatus.Open
  }

  get retentionAnchorAt() {
    return this.closedAt ?? this.cancelledAt
  }

  copyWith(changes: Partial<FamilyFeedbackCampaignInput>): FamilyFeedbackCampaign {
    return new FamilyFeedbackCampaign({ ...this.data, ...changes, updatedAt: changes.updatedAt ?? new Date() })
  }
}
