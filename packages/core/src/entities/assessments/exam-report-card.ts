import type { AttendanceSummary } from '$lib/core/value_object/attendance-summary'
import {
  requireNonBlank,
  requireNonNegativeInt,
  requireNonNegativeNumber,
  requireOptionalNonBlank,
  requirePositiveNumber,
  roundTo2,
} from '$lib/core/utils/validation'

export enum ExamReportCardStatus {
  Draft = 'draft',
  Published = 'published',
}

export interface ExamSubjectResult {
  examSubjectId?: string
  subjectId: string
  subjectName: string
  score: number
  maxScore: number
  coefficient: number
}

export interface ExamReportCardArgs {
  id: string
  studentId: string
  classGroupId: string
  examId: string
  classExamId?: string | null
  periodId: string
  subjectResults: readonly ExamSubjectResult[]
  attendanceSummary: AttendanceSummary
  overallAverage?: number | null
  rank?: number | null
  classSize?: number | null
  passThreshold?: number | null
  teacherComment?: string | null
  principalComment?: string | null
  status?: ExamReportCardStatus
  generatedAt?: Date
  publishedAt?: Date
}

/**
 * Represents an exam-specific report card for a student.
 * Unlike the periodic ReportCardResult which follows the module hierarchy,
 * the ExamReportCard uses a flat list of subject results with their own
 * exam-specific coefficients and weights that may differ from the module structure.
 */
export class ExamReportCard {
  readonly id: string
  readonly studentId: string
  readonly classGroupId: string
  readonly examId: string
  readonly classExamId?: string
  readonly periodId: string
  readonly subjectResults: readonly ExamSubjectResult[]
  readonly attendanceSummary: AttendanceSummary
  readonly overallAverage?: number
  readonly rank?: number
  readonly classSize?: number
  readonly passThreshold?: number
  readonly teacherComment?: string
  readonly principalComment?: string
  readonly status: ExamReportCardStatus
  readonly generatedAt: Date
  readonly publishedAt?: Date

  constructor({
    id,
    studentId,
    classGroupId,
    examId,
    classExamId,
    periodId,
    subjectResults,
    attendanceSummary,
    overallAverage,
    rank,
    classSize,
    passThreshold,
    teacherComment,
    principalComment,
    status = ExamReportCardStatus.Draft,
    generatedAt,
    publishedAt,
  }: ExamReportCardArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.examId = requireNonBlank(examId, 'examId')
    this.classExamId = requireOptionalNonBlank(classExamId, 'classExamId')
    this.periodId = requireNonBlank(periodId, 'periodId')

    this.subjectResults = Object.freeze(
      subjectResults.map(result => ({
        examSubjectId: result.examSubjectId ? requireNonBlank(result.examSubjectId, 'subjectResult.examSubjectId') : undefined,
        subjectId: requireNonBlank(result.subjectId, 'subjectResult.subjectId'),
        subjectName: requireNonBlank(result.subjectName, 'subjectResult.subjectName'),
        score: roundTo2(requireNonNegativeNumber(result.score, 'subjectResult.score')),
        maxScore: roundTo2(requirePositiveNumber(result.maxScore, 'subjectResult.maxScore')),
        coefficient: roundTo2(requirePositiveNumber(result.coefficient, 'subjectResult.coefficient')),
      })),
    )

    this.attendanceSummary = attendanceSummary
    this.overallAverage
      = overallAverage == null ? undefined : roundTo2(requireNonNegativeNumber(overallAverage, 'overallAverage'))
    if (rank != null) {
      this.rank = requireNonNegativeInt(rank, 'rank')
    }
    if (classSize != null) {
      this.classSize = requireNonNegativeInt(classSize, 'classSize')
    }
    if (passThreshold != null) {
      this.passThreshold = roundTo2(requireNonNegativeNumber(passThreshold, 'passThreshold'))
    }
    this.teacherComment = requireOptionalNonBlank(teacherComment, 'teacherComment')
    this.principalComment = requireOptionalNonBlank(principalComment, 'principalComment')
    this.status = status
    this.generatedAt = generatedAt ?? new Date()
    this.publishedAt = publishedAt

    if (this.status === ExamReportCardStatus.Published && !this.publishedAt) {
      throw new Error('publishedAt is required for published exam report cards')
    }
    if (this.status === ExamReportCardStatus.Draft && this.publishedAt) {
      throw new Error('draft exam report cards must not define publishedAt')
    }
  }

  /** Computes the weighted average from subject results. */
  get computedAverage(): number | undefined {
    if (this.subjectResults.length === 0)
      return undefined

    let totalWeightedScore = 0
    let totalCoefficient = 0
    for (const result of this.subjectResults) {
      const normalizedScore = (result.score / result.maxScore) * 20
      totalWeightedScore += normalizedScore * result.coefficient
      totalCoefficient += result.coefficient
    }

    return totalCoefficient > 0 ? roundTo2(totalWeightedScore / totalCoefficient) : undefined
  }

  /** Returns the number of subjects where the student scored at or above the pass threshold. */
  get passedSubjectCount(): number {
    const threshold = this.passThreshold ?? 10
    return this.subjectResults.filter((result) => {
      const normalizedScore = (result.score / result.maxScore) * 20
      return normalizedScore >= threshold
    }).length
  }

  /** Returns the pass rate as a percentage (0–100). */
  get passRate(): number {
    if (this.subjectResults.length === 0)
      return 0
    return roundTo2((this.passedSubjectCount / this.subjectResults.length) * 100)
  }
}
