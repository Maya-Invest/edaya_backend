import type { GradeScale } from '../../../entities/school/grade-scale'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared'
import { requireSchool } from '../../../shared/require-school'

export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'assessments.read_results'), noopReadAccess),
    write: write(action(policy, 'assessments.manage_configuration'), noopSaveAccess, noopDeleteAccess),
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
