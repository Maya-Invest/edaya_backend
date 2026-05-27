import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber, requireValidDate } from '../utils'

export enum AssessmentKind {
  Quiz = 'quiz',
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
  sessionId?: string | null
  dueAt?: Date | null
  metAt?: Date | null
  date?: Date | null
  createdAt?: Date
}

/**
 * Defines a graded activity for a classGroup subject.
 * Assessment results reference an assessment so scoring rules and grading intent stay explicit.
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
  readonly sessionId?: string
  readonly dueAt?: Date
  readonly metAt?: Date
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
    sessionId,
    dueAt,
    metAt,
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
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.dueAt = dueAt ? requireValidDate(dueAt, 'dueAt') : undefined
    this.metAt = metAt ? requireValidDate(metAt, 'metAt') : undefined
    this.date = date ? requireValidDate(date, 'date') : undefined
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()

    if (!this.sessionId && !this.dueAt && !this.date) {
      throw new Error('assessment must be linked to a session, have a due date, or have a date')
    }
  }
}
