import type { ReportCardDefinition } from '../../../entities/assessments/report-card-definition'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared'
import { requireSchool } from '../../../shared/require-school'

export const reportCardDefinitionConfig: EntityConfigFactory<ReportCardDefinition> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.definitions,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'queries.read_report_card_detail'), noopReadAccess),
    write: write(action(policy, 'assessments.manage_configuration'), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateReportCardDefinitionSave,
    },
    atomicExecution,
  })

async function validateReportCardDefinitionSave(
  definition: ReportCardDefinition,
  _existing: ReportCardDefinition | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, definition.schoolId)
  const [academicYear, gradeLevel] = await Promise.all([
    repositories.academicYears.findById(definition.academicYearId),
    repositories.gradeLevels.findById(definition.gradeLevelId),
  ])
  if (!academicYear || academicYear.schoolId !== definition.schoolId) {
    denyResourceAccess()
  }
  if (!gradeLevel || gradeLevel.schoolId !== definition.schoolId) {
    denyResourceAccess()
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
