import type { AcademicYear } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { SchoolStructureOperations, WorkspaceOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/academic-year.ts (PR3)
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
