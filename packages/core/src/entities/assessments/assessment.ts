import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber, requireValidDate } from '$lib/core/utils/validation'

export enum AssessmentKind {
  Quiz = 'quiz',
  Exam = 'exam',
  Homework = 'homework',
  Project = 'project',
  Other = 'other',
}

export interface AssessmentArgs {
  id: string
  classGroupId: string
  classSubjectId: string
  periodId: string
  title: string
  kind: AssessmentKind
  maxScore: number
  coefficient?: number
  examId?: string | null
  sessionId?: string | null
  timetableSlotId?: string | null
  deadlineId?: string | null
  date?: Date | null
  createdAt?: Date
}

/**
 * Defines a graded activity for a classGroup subject.
 * Grades reference an assessment so scoring rules and grading intent stay explicit.
 * Can optionally belong to an Exam for structured exam grouping.
 */
export class Assessment {
  readonly id: string
  readonly classGroupId: string
  readonly classSubjectId: string
  readonly periodId: string
  readonly title: string
  readonly kind: AssessmentKind
  readonly maxScore: number
  readonly coefficient: number
  readonly examId?: string
  readonly sessionId?: string
  readonly timetableSlotId?: string
  readonly deadlineId?: string
  readonly date?: Date
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    classSubjectId,
    periodId,
    title,
    kind,
    maxScore,
    coefficient = 1,
    examId,
    sessionId,
    timetableSlotId,
    deadlineId,
    date,
    createdAt,
  }: AssessmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireNonBlank(classSubjectId, 'classSubjectId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.maxScore = requirePositiveNumber(maxScore, 'maxScore')
    this.coefficient = requirePositiveNumber(coefficient, 'coefficient')
    this.examId = requireOptionalNonBlank(examId, 'examId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.timetableSlotId = requireOptionalNonBlank(timetableSlotId, 'timetableSlotId')
    this.deadlineId = requireOptionalNonBlank(deadlineId, 'deadlineId')
    this.date = date ? requireValidDate(date, 'date') : undefined
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()

    if (!this.sessionId && !this.deadlineId && !this.timetableSlotId && !this.date) {
      throw new Error('assessment must be linked to a session, deadline, timetableSlot, or have a date')
    }
  }
}
