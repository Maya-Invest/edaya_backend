import { requireNonBlank, requirePositiveInt, requirePositiveNumber } from '$lib/core/utils/validation'

export interface ExamSubjectArgs {
  id: string
  examId: string
  subjectId: string
  order: number
  weight: number
  maxScore?: number
  createdAt?: Date
}

/**
 * Defines a subject included in an exam and how it contributes to the exam result.
 * Prefer ReportCardDefinitionSection for new exam report-card layouts.
 */
export class ExamSubject {
  readonly id: string
  readonly examId: string
  readonly subjectId: string
  readonly order: number
  readonly weight: number
  readonly maxScore: number
  readonly createdAt: Date

  constructor({
    id,
    examId,
    subjectId,
    order,
    weight,
    maxScore = 20,
    createdAt,
  }: ExamSubjectArgs) {
    this.id = requireNonBlank(id, 'id')
    this.examId = requireNonBlank(examId, 'examId')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    this.order = requirePositiveInt(order, 'order')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.maxScore = requirePositiveNumber(maxScore, 'maxScore')
    this.createdAt = createdAt ?? new Date()
  }
}
