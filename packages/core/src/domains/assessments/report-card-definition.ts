import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireSchool } from '../../shared/require-school'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum ReportCardDefinitionKind {
  Default = 'default',
  Custom = 'custom',
}

export interface ReportCardDefinitionArgs {
  id: string
  schoolId: string
  academicYearId: string
  gradeLevelId: string
  name: string
  kind?: ReportCardDefinitionKind
  isDefault?: boolean
  description?: string | null
  createdAt?: Date
}

/**
 * Represents a reusable report-card template for a grade level.
 * Sections define the hierarchy, weights, and subject mappings used when
 * generating report-card results.
 */
export class ReportCardDefinition {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly gradeLevelId: string
  readonly name: string
  readonly kind: ReportCardDefinitionKind
  readonly isDefault: boolean
  readonly description?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    gradeLevelId,
    name,
    kind = ReportCardDefinitionKind.Custom,
    isDefault = false,
    description,
    createdAt,
  }: ReportCardDefinitionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.name = requireNonBlank(name, 'name')
    this.kind = kind
    this.isDefault = isDefault
    this.description = requireOptionalNonBlank(description, 'description')
    this.createdAt = createdAt ?? new Date()
  }
}

export const reportCardDefinitionConfig: EntityConfigFactory<ReportCardDefinition> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.definitions,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.QUERY_REPORT_CARD_DETAIL_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.EXAM_CONFIG_CONFIGURE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateReportCardDefinitionSave,
      preDelete: validateReportCardDefinitionDelete,
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
