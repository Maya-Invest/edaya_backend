import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { dateRangeContains, refineEndDateNotBeforeStartDate, refineEndDateNotBeforeStartDatePartial } from '../../domain/value-objects/date-range'
import { parseDomain, zodDate } from '../shared/utils'

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

  constructor(args: AcademicPeriodInput) {
    this.data = parseDomain(academicPeriodSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get type() { return this.data.type }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get isPublished() { return this.data.isPublished }
  get createdAt() { return this.data.createdAt }

  contains(value: Date): boolean {
    return dateRangeContains(this.startDate, this.endDate, value)
  }
}

export const academicPeriodConfig: EntityConfigFactory<AcademicPeriod> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.academicPeriods,
    Permission.QUERY_WORKSPACE_READ,
    Permission.SCHOOL_STRUCTURE_CONFIGURE,
  )
  return {
    ...config,
    gates: {
      preSave: validateAcademicPeriodSave,
      preDelete: validateAcademicPeriodDelete,
    },
  }
}

export async function validateAcademicPeriodSave(
  period: AcademicPeriod,
  _existing: AcademicPeriod | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const academicYear = await repositories.academicYears.findById(period.academicYearId)
  if (!academicYear || academicYear.schoolId !== period.schoolId) {
    denyResourceAccess()
  }
  if (period.startDate.getTime() < academicYear.startDate.getTime() || period.endDate.getTime() > academicYear.endDate.getTime()) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_OUTSIDE_YEAR', `Academic period ${period.id} must fit within academic year ${period.academicYearId}`)
  }
}

export async function validateAcademicPeriodDelete(
  period: AcademicPeriod,
  repositories: SchoolRepositories,
): Promise<void> {
  const [assessments, reportCards] = await Promise.all([
    repositories.assessments.list({ periodId: period.id }),
    repositories.results.list({ periodId: period.id }),
  ])
  if (assessments.length > 0 || reportCards.length > 0) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_HAS_DEPENDENCIES', `Cannot delete academic period ${period.id}: dependent records still exist`)
  }
}
