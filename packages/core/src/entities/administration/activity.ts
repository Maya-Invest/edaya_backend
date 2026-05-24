import { requireNonBlank, requireOptionalNonBlank } from '$lib/core/utils/validation'

export enum ActivityKind {
  Extracurricular = 'extracurricular',
  Assembly = 'assembly',
  Trip = 'trip',
  Other = 'other',
}

export interface ActivityArgs {
  id: string
  schoolId: string
  academicYearId: string
  academicPeriodId?: string | null
  title: string
  description?: string | null
  kind: ActivityKind
  createdAt?: Date
}

/**
 * Represents a planned or recurring activity that is not tied to a subject or module.
 * For example: assemblies, extracurricular activities, trips, etc.
 */
export class Activity {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly academicPeriodId?: string
  readonly title: string
  readonly description?: string
  readonly kind: ActivityKind
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    academicPeriodId,
    title,
    description,
    kind,
    createdAt,
  }: ActivityArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.academicPeriodId = requireOptionalNonBlank(academicPeriodId, 'academicPeriodId')
    this.title = requireNonBlank(title, 'title')
    this.description = requireOptionalNonBlank(description, 'description')
    this.kind = kind
    this.createdAt = createdAt ?? new Date()
  }
}
