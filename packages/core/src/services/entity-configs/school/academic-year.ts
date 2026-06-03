import type { AcademicYear } from '../../../entities/school/academic-year'
import type { EntityConfigFactory } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared'

export const academicYearConfig: EntityConfigFactory<AcademicYear> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.academicYears,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'queries.read_workspace'), noopReadAccess),
    write: write(action(policy, 'setup.manage'), noopSaveAccess, noopDeleteAccess),
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
