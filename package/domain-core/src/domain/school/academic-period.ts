import { z } from 'zod'

import { dateRangeContains, refineEndDateNotBeforeStartDate, refineEndDateNotBeforeStartDatePartial } from '../../domain/value-objects/date-range'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

export enum AcademicPeriodType {
  Trimester = 'trimester',
  Semester = 'semester',
  Other = 'other',
}

export const academicPeriodBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: shortNameSchema.optional(),
  type: z.nativeEnum(AcademicPeriodType).optional(),
  startDate: zodDate(),
  endDate: zodDate(),
  isPublished: z.boolean().default(false),
  createdAt: zodDate().default(() => new Date()),
})

export const academicPeriodSchema = academicPeriodBaseSchema.superRefine(refineEndDateNotBeforeStartDate)

export type AcademicPeriodData = z.infer<typeof academicPeriodSchema>
export type AcademicPeriodInput = z.input<typeof academicPeriodSchema>

export const academicPeriodCreateSchema = academicPeriodBaseSchema.omit({ createdAt: true }).superRefine(refineEndDateNotBeforeStartDate)

export const academicPeriodUpdateSchema = academicPeriodBaseSchema.partial().required({ id: true }).superRefine(refineEndDateNotBeforeStartDatePartial)

/**
 * Represents a specific time period within an academic year (e.g., Trimester, Semester).
 * Used for organizing grading, attendance, and reporting.
 */
export class AcademicPeriod {
  readonly data: AcademicPeriodData

  copyWith(changes: Partial<AcademicPeriodInput>): AcademicPeriod { return new AcademicPeriod({ ...this.data, ...changes }) }

  constructor(args: AcademicPeriodInput) {
    this.data = parseDomain(academicPeriodSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get type() { return this.data.type }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get isPublished() { return this.data.isPublished }
  get createdAt() { return this.data.createdAt }

  contains(value: Date): boolean {
    return dateRangeContains(this.startDate, this.endDate, value)
  }
}
