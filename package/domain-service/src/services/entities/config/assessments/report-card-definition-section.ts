import type { ReportCardDefinitionSection } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardDefinition, ReportCardDefinitionSectionKind } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/assessments/report-card-definition-section.ts (PR3)
export const reportCardDefinitionSectionConfig: EntityConfigFactory<ReportCardDefinitionSection> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.sections,
    tenant: reportCardSectionTenant(),
    resource: 'sections',
    writeLockGroup: 'academic-state',
    hooks: { postSave: section => bumpModel(section, repositories), postDelete: section => bumpModel(section, repositories) },

    gates: {
      preSave: validateReportCardSectionSave,
      preDelete: validateReportCardSectionDelete,
    },
    atomicExecution,
  })

function reportCardSectionTenant(): EntityTenantResolver<ReportCardDefinitionSection> {
  return indirectTenant(async (entity, repositories) => {
    const definition = await repositories.definitions.findById(entity.reportCardDefinitionId)
    return definition?.schoolId
  })
}

async function validateReportCardSectionSave(
  section: ReportCardDefinitionSection,
  existing: ReportCardDefinitionSection | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const definition = await repositories.definitions.findById(section.reportCardDefinitionId)
  if (!definition) {
    denyResourceAccess()
  }
  if (existing && existing.reportCardDefinitionId !== section.reportCardDefinitionId)
    throw new BusinessRuleViolationError('REPORT_SECTION_SCOPE_FIXED', 'A section cannot move to another report model')
  if (section.subjectId) {
    const subject = await repositories.subjects.findById(section.subjectId)
    if (!subject || subject.schoolId !== definition.schoolId || subject.gradeLevelId !== definition.gradeLevelId || subject.academicYearId !== definition.academicYearId)
      denyResourceAccess()
  }
  if (section.kind === ReportCardDefinitionSectionKind.Subject && await repositories.sections.count({ parentSectionId: section.id }))
    throw new BusinessRuleViolationError('SUBJECT_SECTION_HAS_CHILDREN', 'Move child sections before changing this group to a subject')
  if (section.parentSectionId === section.id) {
    throw new BusinessRuleViolationError(
      'REPORT_CARD_SECTION_SELF_PARENT',
      'report card sections must not parent themselves',
    )
  }
  if (!section.parentSectionId)
    return

  const parent = await repositories.sections.findById(section.parentSectionId)
  if (!parent || parent.reportCardDefinitionId !== section.reportCardDefinitionId) {
    denyResourceAccess()
  }
  if (parent.kind !== ReportCardDefinitionSectionKind.Group) {
    throw new BusinessRuleViolationError(
      'SUBJECT_SECTION_HAS_CHILDREN',
      'subject report card sections must not contain child sections',
    )
  }
  await requireAcyclicSectionParent(section.id, parent, repositories)
}

async function requireAcyclicSectionParent(
  sectionId: string,
  parent: ReportCardDefinitionSection,
  repositories: SchoolRepositories,
): Promise<void> {
  let candidate: ReportCardDefinitionSection | undefined = parent
  while (candidate) {
    if (candidate.id === sectionId) {
      throw new BusinessRuleViolationError(
        'REPORT_CARD_SECTION_CYCLE',
        'report card definition sections must not contain cycles',
      )
    }
    candidate = candidate.parentSectionId
      ? await repositories.sections.findById(candidate.parentSectionId)
      : undefined
  }
}

async function validateReportCardSectionDelete(
  section: ReportCardDefinitionSection,
  repositories: SchoolRepositories,
): Promise<void> {
  const children = await repositories.sections.list({ parentSectionId: section.id })
  if (children.length > 0) {
    throw new BusinessRuleViolationError('REPORT_CARD_SECTION_HAS_CHILDREN', `Cannot delete report card section ${section.id}: child sections still exist`)
  }
}

async function bumpModel(section: ReportCardDefinitionSection, repositories: SchoolRepositories): Promise<void> {
  const definition = await repositories.definitions.findById(section.reportCardDefinitionId)
  if (definition)
    await repositories.definitions.forSchool!(definition.schoolId).save(new ReportCardDefinition({ ...definition.data, revision: definition.revision + 1 }))
}
