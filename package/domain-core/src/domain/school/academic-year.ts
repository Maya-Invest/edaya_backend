import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { SchoolStructureOperations, WorkspaceOperations } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
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

export const academicYearConfig: EntityConfigFactory<AcademicYear> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.academicYears,
    tenant: directSchoolTenant(),
    read: read(operationModule(WorkspaceOperations.read), noopReadAccess),
    write: write(operationModule(SchoolStructureOperations.configure), noopSaveAccess, noopDeleteAccess),
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
