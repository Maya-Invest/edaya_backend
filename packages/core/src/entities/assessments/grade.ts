import { requireNonBlank, requireNonNegativeNumber, requirePositiveNumber, roundTo2 } from '../utils'

export enum DeadlineComplianceStatus {
  Met = 'met',
  Late = 'late',
  Missed = 'missed',
  Excused = 'excused',
}

export interface GradeArgs {
  id: string
  studentId: string
  assessmentId: string
  classSubjectId: string
  periodId: string
  score?: number | null
  maxScore?: number
  coefficient?: number
  status?: DeadlineComplianceStatus | null
  notes?: string | null
  createdBy?: string
  createdAt?: Date
}

/**
 * Represents a student's grade/score for a specific subject within a classGroup program.
 * Grades are associated with an academic period and form the basis of the report card.
 * Also tracks student submission compliance status (e.g. met, late, missed, excused) for the assessment.
 */
export class Grade {
  readonly id: string
  readonly studentId: string
  readonly assessmentId: string
  readonly classSubjectId: string
  readonly periodId: string
  readonly score?: number
  readonly maxScore: number
  readonly coefficient: number
  readonly status?: DeadlineComplianceStatus
  readonly notes?: string
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    assessmentId,
    classSubjectId,
    periodId,
    score,
    maxScore = 20,
    coefficient = 1,
    status,
    notes,
    createdBy,
    createdAt,
  }: GradeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.assessmentId = requireNonBlank(assessmentId, 'assessmentId')
    this.classSubjectId = requireNonBlank(classSubjectId, 'classSubjectId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.maxScore = roundTo2(requirePositiveNumber(maxScore, 'maxScore'))

    if (score !== undefined && score !== null) {
      this.score = roundTo2(requireNonNegativeNumber(score, 'score'))
      if (this.score > this.maxScore) {
        throw new Error('score must not exceed maxScore')
      }
    }

    this.coefficient = roundTo2(requirePositiveNumber(coefficient, 'coefficient'))
    this.status = status ?? undefined
    this.notes = notes ?? undefined
    this.createdBy = createdBy
    this.createdAt = createdAt ?? new Date()
  }

  get normalizedScore(): number | undefined {
    return this.score !== undefined ? roundTo2((this.score / this.maxScore) * 20) : undefined
  }

  get weightedPoints(): number | undefined {
    const norm = this.normalizedScore
    return norm !== undefined ? norm * this.coefficient : undefined
  }
}
