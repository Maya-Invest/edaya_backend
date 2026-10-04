import { z } from 'zod'
import { zodDate } from '../shared/utils'

const id = z.string().trim().min(1)
const text = z.string().trim().max(20000).nullable()
export const correctionWorkflowSchema = z.enum(['attendance', 'report_comments', 'logbook', 'discipline'])
export const correctionProposalSchema = z.discriminatedUnion('workflow', [
  z.object({ workflow: z.literal('attendance'), targetId: id, status: z.enum(['present', 'absent', 'late']), notes: text, teacherExplanation: text }).strict(),
  z.object({ workflow: z.literal('report_comments'), targetId: id, teacherComment: text.optional(), sections: z.array(z.object({ sectionId: id, comment: text }).strict()).max(100) }).strict(),
  z.object({ workflow: z.literal('logbook'), targetId: id, sessionNote: text, progress: z.array(z.object({ matterId: id, completedPercentage: z.number().min(0).max(100) }).strict()).max(100) }).strict(),
  z.object({ workflow: z.literal('discipline'), targetId: id, title: id.max(500), description: text, kind: z.enum(['positive', 'minor_infraction', 'major_infraction', 'emergency']), studentIds: z.array(id).max(500) }).strict(),
])
export type CorrectionProposal = z.infer<typeof correctionProposalSchema>
export type CorrectionWorkflow = z.infer<typeof correctionWorkflowSchema>
export const requestTeacherCorrectionSchema = z.object({ requestId: id.max(200), expectedVersion: z.number().int().nonnegative(), reason: id.max(5000), proposal: correctionProposalSchema }).strict()
export const decideTeacherCorrectionSchema = z.object({ requestId: id.max(200), correctionId: id, expectedVersion: z.number().int().nonnegative(), confirmConsequences: z.boolean().default(false) }).strict()
export const rejectTeacherCorrectionSchema = decideTeacherCorrectionSchema.extend({ reason: id.max(5000) })
export const reviseTeacherCorrectionSchema = requestTeacherCorrectionSchema.extend({ correctionId: id })
export const teacherCorrectionSchema = z.object({
  id,
  schoolId: id,
  classGroupId: id,
  studentIds: z.array(id),
  periodId: id.optional(),
  workflow: correctionWorkflowSchema,
  targetId: id,
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']),
  version: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  authorSubjectId: id,
  reason: id,
  before: correctionProposalSchema,
  proposal: correctionProposalSchema,
  consequences: z.array(z.string()),
  createdAt: zodDate(),
  decidedAt: zodDate().optional(),
  decidedBy: id.optional(),
  rejectionReason: z.string().optional(),
  revisions: z.array(z.object({ version: z.number().int().nonnegative(), reason: z.string(), before: correctionProposalSchema, proposal: correctionProposalSchema, at: zodDate() })).default([]),
})
export type TeacherCorrection = z.infer<typeof teacherCorrectionSchema>
export const attendanceCallSchema = z.object({
  requestId: id.max(200),
  expectedVersion: z.number().int().nonnegative(),
  anchor: z.discriminatedUnion('kind', [z.object({ kind: z.literal('lesson'), lessonSessionId: id }).strict(), z.object({ kind: z.literal('daily'), classGroupId: id, date: zodDate() }).strict()]),
  entries: z.array(z.object({ studentId: id, status: z.enum(['present', 'absent', 'late']), notes: text.optional(), teacherExplanation: text.optional() }).strict()).max(500),
}).strict()
export const attendanceArrivalSchema = z.object({ requestId: id.max(200), recordId: id, occurredAt: zodDate(), expectedVersion: z.number().int().nonnegative() }).strict()
export const saveTeacherLogbookSchema = z.object({ requestId: id.max(200), expectedVersion: z.number().int().nonnegative(), proposal: correctionProposalSchema.options[2] }).strict()
export const validateTeacherLogbookSchema = z.object({ requestId: id.max(200), lessonSessionIds: z.array(id).min(1).max(100) }).strict()
export const editTeacherIncidentSchema = z.object({ requestId: id.max(200), expectedVersion: z.number().int().nonnegative(), proposal: correctionProposalSchema.options[3] }).strict()
export const takeOverTeacherIncidentSchema = z.object({ requestId: id.max(200), incidentId: id }).strict()
export const appendIncidentFollowUpSchema = takeOverTeacherIncidentSchema.extend({ text: id.max(20000) })
export const teacherCorrectionsQuerySchema = z.object({ workflow: z.enum(['grades', ...correctionWorkflowSchema.options]).optional(), status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).default('pending'), classGroupId: id.optional(), periodId: id.optional(), teacherSubjectId: id.optional(), studentId: id.optional(), search: z.string().optional(), from: zodDate().optional(), to: zodDate().optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(100).default(25) })
