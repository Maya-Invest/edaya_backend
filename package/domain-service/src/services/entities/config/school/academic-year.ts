import type { AcademicYear } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { reconcileYearSelections } from '../../../../capabilities/subject-enrollment/calendar'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { validateAcademicYearDelete } from './academic-calendar-dependencies'
import { validateAcademicYearSave } from './validate-academic-year-save'

// Extracted from domain/school/academic-year.ts (PR3)
export const academicYearConfig: EntityConfigFactory<AcademicYear> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.academicYears,
    tenant: directSchoolTenant(),
    resource: 'academicYears',
    writeLockGroup: 'academic-state',
    hooks: { postSave: (year, previous, repositories) => reconcileYearSelections(repositories, year, previous) },

    gates: {
      preSave: validateAcademicYearSave,
      preDelete: validateAcademicYearDelete,
    },
    atomicExecution,
  })
