import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '../utils'

export enum DeadlineComplianceStatus {
  Met = 'met',
  Late = 'late',
  Missed = 'missed',
  Excused = 'excused',
}

export interface AssessmentResultArgs {
  id: string
  studentId: string
  assessmentId: string
  score?: number | null
  status?: DeadlineComplianceStatus | null
  notes?: string | null
  createdBy?: string
  createdAt?: Date
}

/**
 * Represents a student's assessment result/score for a specific subject within a classGroup program.
 * Assessment results are associated with an academic period and form the basis of the report card.
 * Also tracks student submission compliance status (e.g. met, late, missed, excused) for the assessment.
 */
export class AssessmentResult {
  readonly id: string
  readonly studentId: string
  readonly assessmentId: string
  readonly score?: number
  readonly status?: DeadlineComplianceStatus
  readonly notes?: string
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    assessmentId,
    score,
    status,
    notes,
    createdBy,
    createdAt,
  }: AssessmentResultArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.assessmentId = requireNonBlank(assessmentId, 'assessmentId')

    if (score !== undefined && score !== null) {
      this.score = roundTo2(requireNonNegativeNumber(score, 'score'))
    }

    this.status = status ?? undefined
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdBy = requireOptionalNonBlank(createdBy, 'createdBy')
    this.createdAt = createdAt ?? new Date()
  }
}
