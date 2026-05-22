import { requireNonBlank, requireNonNegativeNumber, requirePositiveNumber, roundTo2 } from '$lib/core/validation'

export interface GradeArgs {
  id: string
  studentId: string
  assessmentId: string
  moduleId: string
  periodId: string
  score: number
  maxScore?: number
  coefficient?: number
  createdBy?: string
  createdAt?: Date
}

/**
 * Represents a student's grade/score for a specific subject within a classroom program.
 * Grades are associated with an academic period and form the basis of the report card.
 */
export class Grade {
  readonly id: string
  readonly studentId: string
  readonly assessmentId: string
  readonly moduleId: string
  readonly periodId: string
  readonly score: number
  readonly maxScore: number
  readonly coefficient: number
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    assessmentId,
    moduleId,
    periodId,
    score,
    maxScore = 20,
    coefficient = 1,
    createdBy,
    createdAt,
  }: GradeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.assessmentId = requireNonBlank(assessmentId, 'assessmentId')
    this.moduleId = requireNonBlank(moduleId, 'moduleId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.maxScore = roundTo2(requirePositiveNumber(maxScore, 'maxScore'))
    this.score = roundTo2(requireNonNegativeNumber(score, 'score'))
    if (this.score > this.maxScore) {
      throw new Error('score must not exceed maxScore')
    }
    this.coefficient = roundTo2(requirePositiveNumber(coefficient, 'coefficient'))
    this.createdBy = createdBy
    this.createdAt = createdAt ?? new Date()
  }

  get normalizedScore(): number {
    return roundTo2((this.score / this.maxScore) * 20)
  }

  get weightedPoints(): number {
    return this.normalizedScore * this.coefficient
  }
}
