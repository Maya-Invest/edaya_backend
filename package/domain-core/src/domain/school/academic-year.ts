import { z } from 'zod'

import { dateRangeContains, refineEndDateNotBeforeStartDate, refineEndDateNotBeforeStartDatePartial } from '../../domain/value-objects/date-range'
import { BusinessRuleViolationError } from '../shared/business-rule-error'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

export const academicYearStatusSchema = z.enum(['draft', 'published', 'archived'])
export type AcademicYearStatus = z.infer<typeof academicYearStatusSchema>

const ALLOWED_STATUS_TRANSITIONS: Record<AcademicYearStatus, readonly AcademicYearStatus[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: [],
}

export function canTransitionAcademicYearStatus(
  from: AcademicYearStatus,
  to: AcademicYearStatus,
): boolean {
  if (from === to) {
    return true
  }
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to)
}

export function assertAcademicYearStatusTransition(
  from: AcademicYearStatus,
  to: AcademicYearStatus,
): void {
  if (!canTransitionAcademicYearStatus(from, to)) {
    throw new BusinessRuleViolationError(
      'ACADEMIC_YEAR_INVALID_STATUS_TRANSITION',
      `Academic year status cannot transition from ${from} to ${to}`,
    )
  }
}

export const academicYearBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: shortNameSchema.optional(),
  startDate: zodDate(),
  endDate: zodDate(),
  status: academicYearStatusSchema.default('draft'),
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

  copyWith(changes: Partial<AcademicYearInput>): AcademicYear { return new AcademicYear({ ...this.data, ...changes }) }

  constructor(args: AcademicYearInput) {
    this.data = parseDomain(academicYearSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get status() { return this.data.status }
  get createdAt() { return this.data.createdAt }

  contains(value: Date): boolean {
    return dateRangeContains(this.startDate, this.endDate, value)
  }

  canTransitionTo(next: AcademicYearStatus): boolean {
    return canTransitionAcademicYearStatus(this.status, next)
  }

  assertTransitionTo(next: AcademicYearStatus): void {
    assertAcademicYearStatusTransition(this.status, next)
  }
}
