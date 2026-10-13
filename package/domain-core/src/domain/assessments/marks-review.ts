import { z } from 'zod'
import { zodDate } from '../shared/utils'
import { DeadlineComplianceStatus } from './assessment-result'

export const marksStatusSchema = z.enum(['draft', 'submitted'])
export type MarksStatus = z.infer<typeof marksStatusSchema>

export const marksReviewSchema = z.object({
  rosterStudentIds: z.array(z.string()).default([]),
  markEditorSubjectIds: z.record(z.string(), z.string()).default({}),
  editedBySubjectIds: z.array(z.string()).default([]),
  submittedBy: z.string().optional(),
  submittedAt: zodDate().optional(),
  history: z.array(z.object({
    action: z.enum(['submit']),
    revision: z.number().int().nonnegative(),
    subjectId: z.string(),
    at: zodDate(),
    reason: z.string().optional(),
  })).default([]),
})

export const markCorrectionValuesSchema = z.object({
  mentionId: z.string().min(1).nullable().optional(),
  score: z.number().finite().nonnegative().nullable(),
  designation: z.enum(['scored', 'absent', 'exempt']),
  notes: z.string().trim().min(1).nullable(),
  status: z.nativeEnum(DeadlineComplianceStatus).nullable().optional(),
}).strict()
export const requestMarksCorrectionSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  assessmentId: z.string().trim().min(1),
  expectedRevision: z.number().int().nonnegative(),
  expectedGradingRevision: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1),
  changes: z.array(z.object({ resultId: z.string().min(1), proposed: markCorrectionValuesSchema }).strict()).min(1).max(500),
}).strict()
export const decideMarksCorrectionSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  correctionId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
}).strict()
export const rejectMarksCorrectionSchema = decideMarksCorrectionSchema.extend({ reason: z.string().trim().min(1) })
export const marksCorrectionSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  assessmentId: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']),
  version: z.number().int().nonnegative(),
  baseRevision: z.number().int().nonnegative(),
  baseGradingRevision: z.number().int().nonnegative().optional(),
  authorSubjectId: z.string(),
  reason: z.string(),
  createdAt: zodDate(),
  changes: z.array(z.object({ resultId: z.string(), studentId: z.string(), revision: z.number().int().nonnegative(), before: markCorrectionValuesSchema, proposed: markCorrectionValuesSchema })),
  revisions: z.array(z.object({ version: z.number().int().nonnegative(), reason: z.string(), changes: z.array(z.object({ resultId: z.string(), studentId: z.string(), revision: z.number().int().nonnegative(), before: markCorrectionValuesSchema, proposed: markCorrectionValuesSchema })), at: zodDate() })).default([]),
  decidedBy: z.string().optional(),
  decidedAt: zodDate().optional(),
  rejectionReason: z.string().optional(),
})
export type MarksCorrection = z.infer<typeof marksCorrectionSchema>
export type RequestMarksCorrectionInput = z.infer<typeof requestMarksCorrectionSchema>
export type DecideMarksCorrectionInput = z.infer<typeof decideMarksCorrectionSchema>
export type RejectMarksCorrectionInput = z.infer<typeof rejectMarksCorrectionSchema>

export const reviseMarksCorrectionSchema = requestMarksCorrectionSchema.extend({ correctionId: z.string().min(1), expectedVersion: z.number().int().nonnegative() })
export type ReviseMarksCorrectionInput = z.infer<typeof reviseMarksCorrectionSchema>
