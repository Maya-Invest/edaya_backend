import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'

export const familyFeedbackCommentReadAuditSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  campaignId: z.string().trim().min(1, 'campaignId must not be blank'),
  actorId: z.string().trim().min(1, 'actorId must not be blank'),
  actorKind: z.string().trim().min(1, 'actorKind must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  readAt: zodDate().default(() => new Date()),
})

export type FamilyFeedbackCommentReadAuditData = z.infer<typeof familyFeedbackCommentReadAuditSchema>
export type FamilyFeedbackCommentReadAuditInput = z.input<typeof familyFeedbackCommentReadAuditSchema>

export class FamilyFeedbackCommentReadAudit {
  readonly data: FamilyFeedbackCommentReadAuditData

  constructor(args: FamilyFeedbackCommentReadAuditInput) {
    this.data = parseDomain(familyFeedbackCommentReadAuditSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get campaignId() { return this.data.campaignId }
  get actorId() { return this.data.actorId }
  get actorKind() { return this.data.actorKind }
  get subjectId() { return this.data.subjectId }
  get readAt() { return this.data.readAt }
}
