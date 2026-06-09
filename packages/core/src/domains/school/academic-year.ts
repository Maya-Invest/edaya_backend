import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export const academicYearBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  startDate: zodDate(),
  endDate: zodDate(),
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export const academicYearSchema = academicYearBaseSchema.refine(
  data => data.endDate.getTime() >= data.startDate.getTime(),
  {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  },
)

export type AcademicYearData = z.infer<typeof academicYearSchema>

export const academicYearCreateSchema = academicYearBaseSchema.omit({ createdAt: true }).refine(
  data => data.endDate.getTime() >= data.startDate.getTime(),
  {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  },
)

export const academicYearUpdateSchema = academicYearBaseSchema.partial().required({ id: true }).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate.getTime() >= data.startDate.getTime()
    }
    return true
  },
  {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  },
)

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
  readonly data: AcademicYearData

  constructor(args: AcademicYearArgs) {
    const result = academicYearSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get startDate() { return this.data.startDate }
  get endDate() { return this.data.endDate }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }

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
