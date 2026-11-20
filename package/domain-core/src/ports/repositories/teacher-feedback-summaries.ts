import { z } from 'zod'
import { familyFeedbackAggregatePayloadSchema } from '../../domain/family-feedback/snapshot'

export const teacherFeedbackSummary = familyFeedbackAggregatePayloadSchema.omit({ questions: true }).extend({
  campaignId: z.string(),
  academicYearId: z.string(),
  academicPeriodId: z.string(),
  classGroupId: z.string(),
  classSubjectId: z.string(),
})
export const teacherFeedbackSelection = z.object({ classGroupId: z.string().min(1).optional(), classSubjectId: z.string().min(1).optional() })
export type TeacherFeedbackSelection = z.infer<typeof teacherFeedbackSelection>

export interface TeacherFeedbackSummariesPort {
  list: (schoolId: string, teacherId: string, selection: TeacherFeedbackSelection) => Promise<z.infer<typeof teacherFeedbackSummary>[]>
}
