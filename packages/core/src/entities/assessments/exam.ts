import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requirePositiveNumber, requireValidDate } from '$lib/core/utils/validation'

export enum ExamKind {
  Sequence = 'sequence',
  Composition = 'composition',
}

export interface ExamArgs {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  kind: ExamKind
  order: number
  weight: number
  reportCardDefinitionId?: string | null
  startDate?: Date | null
  endDate?: Date | null
  createdAt?: Date
}

/**
 * Defines an exam event for an academic year, such as "Bac Blanc 2027".
 * Assessments can optionally link to an exam, and an exam can optionally use
 * a dedicated report-card definition for generated results.
 */
export class Exam {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly name: string
  readonly kind: ExamKind
  readonly order: number
  readonly weight: number
  readonly reportCardDefinitionId?: string
  readonly startDate?: Date
  readonly endDate?: Date
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    name,
    kind,
    order,
    weight,
    reportCardDefinitionId,
    startDate,
    endDate,
    createdAt,
  }: ExamArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.name = requireNonBlank(name, 'name')
    this.kind = kind
    this.order = requirePositiveInt(order, 'order')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.reportCardDefinitionId = requireOptionalNonBlank(reportCardDefinitionId, 'reportCardDefinitionId')

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
