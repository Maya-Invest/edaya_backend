import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../../utils/validation'

export enum ClassExamStatus {
  Planned = 'planned',
  Open = 'open',
  Closed = 'closed',
  Published = 'published',
  Cancelled = 'cancelled',
}

export interface ClassExamArgs {
  id: string
  examId: string
  classGroupId: string
  periodId: string
  status?: ClassExamStatus
  notes?: string | null
  createdAt?: Date
  closedAt?: Date | null
  publishedAt?: Date | null
}

/**
 * Links an exam definition to a class and academic period.
 */
export class ClassExam {
  readonly id: string
  readonly examId: string
  readonly classGroupId: string
  readonly periodId: string
  readonly status: ClassExamStatus
  readonly notes?: string
  readonly createdAt: Date
  readonly closedAt?: Date
  readonly publishedAt?: Date

  constructor({
    id,
    examId,
    classGroupId,
    periodId,
    status = ClassExamStatus.Planned,
    notes,
    createdAt,
    closedAt,
    publishedAt,
  }: ClassExamArgs) {
    this.id = requireNonBlank(id, 'id')
    this.examId = requireNonBlank(examId, 'examId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.status = status
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdAt = createdAt ?? new Date()
    this.closedAt = closedAt ? requireValidDate(closedAt, 'closedAt') : undefined
    this.publishedAt = publishedAt ? requireValidDate(publishedAt, 'publishedAt') : undefined

    if (this.status === ClassExamStatus.Closed && !this.closedAt) {
      throw new Error('closedAt is required for closed class exams')
    }
    if (this.status === ClassExamStatus.Published && !this.publishedAt) {
      throw new Error('publishedAt is required for published class exams')
    }
  }
}
