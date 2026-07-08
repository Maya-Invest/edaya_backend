import { z } from 'zod'

import { dateRangeContains, refineEndDateNotBeforeStartDate, refineEndDateNotBeforeStartDatePartial } from '../../domain/value-objects/date-range'

import { parseDomain, zodDate } from '../shared/utils'

export const academicYearBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  startDate: zodDate(),
  endDate: zodDate(),
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export const academicYearSchema = academicYearBaseSchema.superRefine(refineEndDateNotBeforeStartDate)

export type AcademicYearData = z.infer<typeof academicYearSchema>
export type AcademicYearInput = z.input<typeof academicYearSchema>

export const academicYearCreateSchema = academicYearBaseSchema.omit({ createdAt: true }).superRefine(refineEndDateNotBeforeStartDate)

export const academicYearUpdateSchema = academicYearBaseSchema.partial().required({ id: true }).superRefine(refineEndDateNotBeforeStartDatePartial)

/**
 * Represents a full academic year for a school.
 * Contains multiple academic periods and defines the overall timeline.
 */
export class AcademicYear {
  readonly data: AcademicYearData

  constructor(args: AcademicYearInput) {
    this.data = parseDomain(academicYearSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }

  contains(value: Date): boolean {
    return dateRangeContains(this.startDate, this.endDate, value)
  }
}
