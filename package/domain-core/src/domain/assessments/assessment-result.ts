import { z } from 'zod'

import { parseDomain, roundTo2, zodDate } from '../shared/utils'

export enum DeadlineComplianceStatus {
  Met = 'met',
  Late = 'late',
  Missed = 'missed',
  Excused = 'excused',
}

export const assessmentResultSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  revision: z.number().int().nonnegative().default(0),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank'),
  score: z.number().finite().nonnegative('score must be a finite, non-negative number').transform(v => roundTo2(v)).nullable().optional().transform(v => v === null ? undefined : v),
  designation: z.enum(['scored', 'absent', 'exempt']).optional(),
  status: z.nativeEnum(DeadlineComplianceStatus).nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdBy: z.string().trim().min(1, 'createdBy must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type AssessmentResultData = z.infer<typeof assessmentResultSchema>
export type AssessmentResultInput = z.input<typeof assessmentResultSchema>

export const assessmentResultCreateSchema = assessmentResultSchema.omit({ createdAt: true })
export const assessmentResultUpdateSchema = assessmentResultSchema.partial().required({ id: true })

/**
 * Represents a student's assessment result/score for a specific subject within a classGroup program.
 * Assessment results are associated with an academic period and form the basis of the report card.
 * Also tracks student submission compliance status (e.g. met, late, missed, excused) for the assessment.
 */
export class AssessmentResult {
  readonly data: AssessmentResultData

  constructor(args: AssessmentResultInput) {
    this.data = parseDomain(assessmentResultSchema, args)
  }

  get id() { return this.data.id }
  get revision() { return this.data.revision }
  get studentId() { return this.data.studentId }
  get assessmentId() { return this.data.assessmentId }
  get score() { return this.data.score }
  get designation() { return this.data.designation }
  get status() { return this.data.status }
  get notes() { return this.data.notes }
  get createdBy() { return this.data.createdBy }
  get createdAt() { return this.data.createdAt }
}
