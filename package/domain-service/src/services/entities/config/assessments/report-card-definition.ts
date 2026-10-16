import type { ReportCardDefinition } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardDefinition as Definition } from '@edaya/core'
import { requireSchool } from '../../../require-school'
import { config } from '../../entity-config'

import { directSchoolTenant } from '../../entity-config/tenant'
// Extracted from domain/assessments/report-card-definition.ts (PR3)
export const reportCardDefinitionConfig: EntityConfigFactory<ReportCardDefinition> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.definitions,
    tenant: directSchoolTenant(),
    resource: 'definitions',
    writeLockGroup: 'academic-state',
    hooks: { postSave: async (definition, existing, repos) => {
      if (existing)
        await repos.definitions.forSchool!(definition.schoolId).save(new Definition({ ...definition.data, revision: existing.revision + 1 }))
    } },

    gates: {
      preSave: validateReportCardDefinitionSave,
      preDelete: validateReportCardDefinitionDelete,
    },
    atomicExecution,
  })

async function validateReportCardDefinitionSave(
  definition: ReportCardDefinition,
  existing: ReportCardDefinition | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && definition.revision !== existing.revision)
    throw new BusinessRuleViolationError('REPORT_MODEL_REVISION_CONFLICT', 'Reload the report model before saving')
  if (existing && (definition.academicYearId !== existing.academicYearId || definition.gradeLevelId !== existing.gradeLevelId))
    throw new BusinessRuleViolationError('REPORT_MODEL_SCOPE_FIXED', 'The year and grade level cannot change')
  await requireSchool(repositories.schools, definition.schoolId)
  const [academicYear, gradeLevel, gradeScale] = await Promise.all([
    repositories.academicYears.findById(definition.academicYearId),
    repositories.gradeLevels.findById(definition.gradeLevelId),
    repositories.gradeScales.findById(definition.gradeScaleId),
  ])
  if (!academicYear || academicYear.schoolId !== definition.schoolId) {
    denyResourceAccess()
  }
  if (!gradeLevel || gradeLevel.schoolId !== definition.schoolId) {
    denyResourceAccess()
  }
  if (!gradeScale || gradeScale.schoolId !== definition.schoolId) {
    denyResourceAccess()
  }
  if (!gradeScale.isComplete)
    throw new BusinessRuleViolationError('GRADE_SCALE_INCOMPLETE', 'Choose a complete grade scale')
  const policy = gradeLevel.gradingPolicyFor(definition.academicYearId)
  if (policy && definition.gradeScaleId !== policy.scale.id)
    throw new BusinessRuleViolationError('GRADING_SCALE_INHERITED', 'Report models must use the grade level grading scale')
  const scale = policy?.scale ?? gradeScale.data
  if (definition.passThreshold !== undefined) {
    const value = definition.passThreshold
    const scaled = value * 10 ** scale.decimalPlaces
    if (value < scale.minScore || value > scale.maxScore || Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4)
      throw new BusinessRuleViolationError('INVALID_REPORT_PASS_THRESHOLD', 'Passing threshold must be within the inherited scale bounds and precision')
  }
  if (!definition.isDefault)
    return

  const existingDefault = await repositories.definitions.findOne({
    gradeLevelId: definition.gradeLevelId,
    academicYearId: definition.academicYearId,
    isDefault: true,
  })
  if (existingDefault && existingDefault.id !== definition.id) {
    throw new BusinessRuleViolationError(
      'DEFAULT_REPORT_CARD_DEFINITION_ALREADY_EXISTS',
      `Grade level ${definition.gradeLevelId} already has a default report card definition`,
    )
  }
}

async function validateReportCardDefinitionDelete(
  definition: ReportCardDefinition,
  repositories: SchoolRepositories,
): Promise<void> {
  const [sections, results] = await Promise.all([
    repositories.sections.list({ reportCardDefinitionId: definition.id }),
    repositories.results.list({ reportCardDefinitionId: definition.id }),
  ])
  if (sections.length > 0 || results.length > 0) {
    throw new BusinessRuleViolationError('REPORT_CARD_DEFINITION_HAS_DEPENDENCIES', `Cannot delete report card definition ${definition.id}: dependent records still exist`)
  }
}
