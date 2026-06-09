import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireValidDate } from '../utils'

export interface AcademicYearArgs {
  id: string
  schoolId: string
  name: string
  startDate: Date
  endDate: Date
  isActive?: boolean
  createdAt?: Date
}

/**
 * Represents a full academic year for a school.
 * Contains multiple academic periods and defines the overall timeline.
 */
export class AcademicYear {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly startDate: Date
  readonly endDate: Date
  readonly isActive: boolean
  readonly createdAt: Date

  constructor({ id, schoolId, name, startDate, endDate, isActive = true, createdAt }: AcademicYearArgs) {
    const normalizedStartDate = requireValidDate(startDate, 'startDate')
    const normalizedEndDate = requireValidDate(endDate, 'endDate')
    if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
      throw new Error('endDate must not be before startDate')
    }

    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.startDate = normalizedStartDate
    this.endDate = normalizedEndDate
    this.isActive = isActive
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()
  }

  contains(value: Date): boolean {
    return value.getTime() >= this.startDate.getTime() && value.getTime() <= this.endDate.getTime()
  }
}

export const academicYearConfig: EntityConfigFactory<AcademicYear> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.academicYears,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.QUERY_WORKSPACE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.SCHOOL_STRUCTURE_CONFIGURE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preDelete: async (year, repos) => {
        const classGroups = await repos.classGroups.list({ academicYearId: year.id })
        if (classGroups.length > 0) {
          throw new BusinessRuleViolationError(
            'ACADEMIC_YEAR_HAS_CLASS_GROUPS',
            `Cannot delete academic year ${year.id}: class groups still exist`,
          )
        }
      },
    },
    atomicExecution,
  })
