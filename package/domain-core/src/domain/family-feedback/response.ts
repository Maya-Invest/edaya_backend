import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import {
  FAMILY_FEEDBACK_CANNOT_ASSESS,
  FAMILY_FEEDBACK_COMMENT_MAX_CHARS,
  FAMILY_FEEDBACK_QUESTION_IDS,
  FAMILY_FEEDBACK_SCORED_VALUES,
} from './catalog'

const answerSchema = z.union([
  z.literal(FAMILY_FEEDBACK_CANNOT_ASSESS),
  z.number().int().refine(value => (FAMILY_FEEDBACK_SCORED_VALUES as readonly number[]).includes(value), 'answer must be 1-5 or cannot_assess'),
])

export const familyFeedbackAnswersSchema = z.object({
  communication: answerSchema,
  clarity: answerSchema,
  support: answerSchema,
  student_experience: answerSchema,
})

export type FamilyFeedbackAnswers = z.infer<typeof familyFeedbackAnswersSchema>

export const familyFeedbackResponseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  campaignId: z.string().trim().min(1, 'campaignId must not be blank'),
  slotId: z.string().trim().min(1, 'slotId must not be blank'),
  answers: familyFeedbackAnswersSchema,
  comment: z.string().trim().min(1).max(FAMILY_FEEDBACK_COMMENT_MAX_CHARS).nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type FamilyFeedbackResponseData = z.infer<typeof familyFeedbackResponseSchema>
export type FamilyFeedbackResponseInput = z.input<typeof familyFeedbackResponseSchema>

export class FamilyFeedbackResponse {
  readonly data: FamilyFeedbackResponseData

  constructor(args: FamilyFeedbackResponseInput) {
    this.data = parseDomain(familyFeedbackResponseSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get campaignId() { return this.data.campaignId }
  get slotId() { return this.data.slotId }
  get answers() { return this.data.answers }
  get comment() { return this.data.comment }
  get createdAt() { return this.data.createdAt }
}

export function requireFamilyFeedbackAnswers(input: unknown): FamilyFeedbackAnswers {
  const parsed = familyFeedbackAnswersSchema.safeParse(input)
  if (!parsed.success) {
    throw parsed.error
  }
  for (const id of FAMILY_FEEDBACK_QUESTION_IDS) {
    if (parsed.data[id] === undefined)
      throw parsed.error
  }
  return parsed.data
}
