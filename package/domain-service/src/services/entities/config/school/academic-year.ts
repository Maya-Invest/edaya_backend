import { Permission } from '@edaya/core';
import type { AcademicYear } from '@edaya/core';
import type { EntityConfigFactory } from '../../entity-config';

import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';
import { validateAcademicYearSave } from './validate-academic-year-save';

// Extracted from domain/school/academic-year.ts (PR3)
export const academicYearConfig: EntityConfigFactory<AcademicYear> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.academicYears,
    tenant: directSchoolTenant(),
    authorization: { resource: 'academicYears', read: [Permission.QUERY_WORKSPACE_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
    
    gates: {
      preSave: validateAcademicYearSave,
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
