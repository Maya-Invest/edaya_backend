import type { GradeScale } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { BusinessRuleViolationError, GradeScale as Scale } from '@edaya/core'
import { requireSchool } from '../../../require-school'
import { config } from '../../entity-config'

import { directSchoolTenant } from '../../entity-config/tenant'
// Extracted from domain/school/grade-scale.ts (PR3)
export const gradeScaleConfig: EntityConfigFactory<GradeScale> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeScales,
    tenant: directSchoolTenant(),
    resource: 'gradeScales',
    writeLockGroup: 'academic-state',
    hooks: { postSave: async (scale, existing, repos) => {
      if (existing)
        await repos.gradeScales.forSchool!(scale.schoolId).save(new Scale({ ...scale.data, ranges: [...scale.ranges], revision: existing.revision + 1 }))
    } },

    gates: {
      preSave: validateGradeScaleSave,
      preDelete: validateGradeScaleDelete,
    },
    atomicExecution,
  })

async function validateGradeScaleSave(
  gradeScale: GradeScale,
  existing: GradeScale | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, gradeScale.schoolId)
  if (existing && gradeScale.revision !== existing.revision)
    throw new BusinessRuleViolationError('GRADE_SCALE_REVISION_CONFLICT', 'Reload the scale before saving')
  if (!gradeScale.isComplete && (existing?.isDefault || await scaleIsUsed(gradeScale.id, repositories)))
    throw new BusinessRuleViolationError('GRADE_SCALE_INCOMPLETE', 'A used or default scale must remain complete')
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

async function scaleIsUsed(id: string, repositories: SchoolRepositories): Promise<boolean> {
  const scale = await repositories.gradeScales.findById(id)
  if (!scale)
    return false
  const levels = await repositories.gradeLevels.list({ schoolId: scale.schoolId })
  return levels.some(level => level.gradingPolicies.some(policy => policy.scale.id === id))
}
async function validateGradeScaleDelete(scale: GradeScale, repositories: SchoolRepositories): Promise<void> {
  if (scale.isDefault || await scaleIsUsed(scale.id, repositories))
    throw new BusinessRuleViolationError('GRADE_SCALE_IN_USE', 'A default or referenced scale cannot be deleted')
}
