import { Permission } from '@edaya/core';
import type { GradeScale } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';

import { BusinessRuleViolationError } from '@edaya/core';
import { requireSchool } from '../../../require-school';
import { config } from '../../entity-config';

import { directSchoolTenant } from '../../entity-config/tenant';
// Extracted from domain/school/grade-scale.ts (PR3)
export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    authorization: { resource: 'gradeScales', read: [Permission.GRADE_READ], write: [Permission.EXAM_CONFIG_CONFIGURE] },
    
    gates: {
      preSave: validateGradeScaleSave,
    },
    atomicExecution,
  })

async function validateGradeScaleSave(
  gradeScale: GradeScale,
  _existing: GradeScale | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, gradeScale.schoolId)
  if (!gradeScale.isDefault)
    return

  const existingDefault = await repositories.gradeScales.findOne({
    schoolId: gradeScale.schoolId,
    isDefault: true,
  })
  if (existingDefault && existingDefault.id !== gradeScale.id) {
    throw new BusinessRuleViolationError(
      'DEFAULT_GRADE_SCALE_ALREADY_EXISTS',
      `School ${gradeScale.schoolId} already has a default grade scale`,
    )
  }
}
