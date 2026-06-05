import type { AcademicYear } from '../../../entities/school/academic-year'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

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
