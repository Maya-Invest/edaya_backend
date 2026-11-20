import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import { FAMILY_FEEDBACK_QUESTION_IDS } from './catalog'

export const familyFeedbackQuestionAggregateSchema = z.object({
  questionId: z.enum(FAMILY_FEEDBACK_QUESTION_IDS),
  suppressed: z.boolean(),
  nScored: z.number().int().nonnegative(),
  nCannotAssess: z.number().int().nonnegative(),
  distribution: z.object({
    1: z.number().int().nonnegative(),
    2: z.number().int().nonnegative(),
    3: z.number().int().nonnegative(),
    4: z.number().int().nonnegative(),
    5: z.number().int().nonnegative(),
  }),
})

export const familyFeedbackAggregatePayloadSchema = z.object({
  eligibleSlotCount: z.number().int().nonnegative(),
  completedSlotCount: z.number().int().nonnegative(),
  responseRate: z.number().min(0).max(1),
  overallSuppressed: z.boolean(),
  questions: z.array(familyFeedbackQuestionAggregateSchema).length(FAMILY_FEEDBACK_QUESTION_IDS.length),
  themes: z.string().trim().min(1).max(8000).nullable().optional().transform(v => v === null ? undefined : v),
})

export type FamilyFeedbackQuestionAggregate = z.infer<typeof familyFeedbackQuestionAggregateSchema>
export type FamilyFeedbackAggregatePayload = z.infer<typeof familyFeedbackAggregatePayloadSchema>

export const familyFeedbackSnapshotSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  campaignId: z.string().trim().min(1, 'campaignId must not be blank'),
  payload: familyFeedbackAggregatePayloadSchema,
  publishedAt: zodDate(),
  publishedByStaffId: z.string().trim().min(1, 'publishedByStaffId must not be blank'),
})

export type FamilyFeedbackSnapshotData = z.infer<typeof familyFeedbackSnapshotSchema>
export type FamilyFeedbackSnapshotInput = z.input<typeof familyFeedbackSnapshotSchema>

export function familyFeedbackSnapshotId(campaignId: string): string {
  return `ffsnap:${campaignId}`
}

export class FamilyFeedbackSnapshot {
  readonly data: FamilyFeedbackSnapshotData

  constructor(args: FamilyFeedbackSnapshotInput) {
    this.data = parseDomain(familyFeedbackSnapshotSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get campaignId() { return this.data.campaignId }
  get payload() { return this.data.payload }
  get publishedAt() { return this.data.publishedAt }
  get publishedByStaffId() { return this.data.publishedByStaffId }
}
