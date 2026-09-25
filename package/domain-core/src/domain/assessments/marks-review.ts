import { z } from 'zod'
import { zodDate } from '../shared/utils'

export const marksStatusSchema = z.enum(['draft', 'submitted', 'approved'])
export type MarksStatus = z.infer<typeof marksStatusSchema>

export const marksReviewSchema = z.object({
  rosterStudentIds: z.array(z.string()).default([]),
  markEditorSubjectIds: z.record(z.string(), z.string()).default({}),
  editedBySubjectIds: z.array(z.string()).default([]),
  submittedBy: z.string().optional(),
  submittedAt: zodDate().optional(),
  approvedBy: z.string().optional(),
  approvedAt: zodDate().optional(),
  history: z.array(z.object({
    action: z.enum(['submit', 'approve', 'return']),
    revision: z.number().int().nonnegative(),
    subjectId: z.string(),
    at: zodDate(),
    reason: z.string().optional(),
  })).default([]),
})
