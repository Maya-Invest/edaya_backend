import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { requireSchool } from '../../application/require-school'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum ReportCardDefinitionKind {
  Default = 'default',
  Custom = 'custom',
}

export enum ReportCardDefinitionStatus {
  Draft = 'draft',
  Published = 'published',
}

export const reportCardDefinitionSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  gradeScaleId: z.string().trim().min(1, 'gradeScaleId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  kind: z.nativeEnum(ReportCardDefinitionKind).default(ReportCardDefinitionKind.Custom),
  status: z.nativeEnum(ReportCardDefinitionStatus).default(ReportCardDefinitionStatus.Draft),
  isDefault: z.boolean().default(false),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type ReportCardDefinitionData = z.infer<typeof reportCardDefinitionSchema>
export type ReportCardDefinitionInput = z.input<typeof reportCardDefinitionSchema>

export const reportCardDefinitionCreateSchema = reportCardDefinitionSchema.omit({ createdAt: true })
export const reportCardDefinitionUpdateSchema = reportCardDefinitionSchema.partial().required({ id: true })

/**
 * Represents a reusable report-card template for a grade level.
 * Sections define the hierarchy, weights, and subject mappings used when
 * generating report-card results.
 */
export class ReportCardDefinition {
  readonly data: ReportCardDefinitionData

  constructor(args: ReportCardDefinitionInput) {
    this.data = parseDomain(reportCardDefinitionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get gradeLevelId() { return this.data.gradeLevelId }
  get gradeScaleId() { return this.data.gradeScaleId }
  get name() { return this.data.name }
  get kind() { return this.data.kind }
  get status() { return this.data.status }
  get isDefault() { return this.data.isDefault }
  get description() { return this.data.description }
  get createdAt() { return this.data.createdAt }
}

export const reportCardDefinitionConfig: EntityConfigFactory<ReportCardDefinition> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.definitions,
    tenant: directSchoolTenant(),
    read: read(permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ), noopReadAccess),
    write: write(permissionAction(Permission.EXAM_CONFIG_CONFIGURE), noopSaveAccess, noopDeleteAccess),
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
