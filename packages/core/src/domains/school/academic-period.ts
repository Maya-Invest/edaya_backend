import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireValidDate } from '../utils'

export enum AcademicPeriodType {
  Trimester = 'trimester',
  Semester = 'semester',
  Other = 'other',
}

export interface AcademicPeriodArgs {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  type: AcademicPeriodType
  startDate: Date
  endDate: Date
  isPublished?: boolean
  createdAt?: Date
}

/**
 * Represents a specific time period within an academic year (e.g., Trimester, Semester).
 * Used for organizing grading, attendance, and reporting.
 */
export class AcademicPeriod {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly name: string
  readonly type: AcademicPeriodType
  readonly startDate: Date
  readonly endDate: Date
  readonly isPublished: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    name,
    type,
    startDate,
    endDate,
    isPublished = false,
    createdAt,
  }: AcademicPeriodArgs) {
    const normalizedStartDate = requireValidDate(startDate, 'startDate')
    const normalizedEndDate = requireValidDate(endDate, 'endDate')
    if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.name = requireNonBlank(name, 'name')
    this.type = type
    this.startDate = normalizedStartDate
    this.endDate = normalizedEndDate
    this.isPublished = isPublished
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()
  }

  contains(value: Date): boolean {
    return value.getTime() >= this.startDate.getTime() && value.getTime() <= this.endDate.getTime()
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
