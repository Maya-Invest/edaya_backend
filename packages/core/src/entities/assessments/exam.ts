import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requirePositiveNumber, requireValidDate } from '$lib/core/utils/validation'

export enum ExamKind {
  Sequence = 'sequence',
  Composition = 'composition',
}

export interface ExamArgs {
  id: string
  schoolId: string
  periodId: string
  classroomId?: string | null
  name: string
  kind: ExamKind
  order: number
  weight: number
  startDate?: Date | null
  endDate?: Date | null
  createdAt?: Date
}

/**
 * Groups assessments within an academic period into distinct exam rounds
 * (e.g., "Séquence 1", "Composition du 1er Trimestre").
 * Each exam has a weight that determines its contribution to the period average.
 */
export class Exam {
  readonly id: string
  readonly schoolId: string
  readonly periodId: string
  readonly classroomId?: string
  readonly name: string
  readonly kind: ExamKind
  readonly order: number
  readonly weight: number
  readonly startDate?: Date
  readonly endDate?: Date
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    periodId,
    classroomId,
    name,
    kind,
    order,
    weight,
    startDate,
    endDate,
    createdAt,
  }: ExamArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.classroomId = requireOptionalNonBlank(classroomId, 'classroomId')
    this.name = requireNonBlank(name, 'name')
    this.kind = kind
    this.order = requirePositiveInt(order, 'order')
    this.weight = requirePositiveNumber(weight, 'weight')

    if (startDate != null) {
      this.startDate = requireValidDate(startDate, 'startDate')
    }
    if (endDate != null) {
      this.endDate = requireValidDate(endDate, 'endDate')
    }
    if (this.startDate && this.endDate && this.endDate.getTime() < this.startDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
