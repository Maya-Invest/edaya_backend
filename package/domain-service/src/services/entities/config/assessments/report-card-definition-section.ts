import type { AuthorizationPolicy } from '@edaya/authorization'
import type { ReportCardDefinitionSection } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AcademicsOperations, denyResourceAccess, ReportCardOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardDefinitionSectionKind } from '@edaya/core'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/assessments/report-card-definition-section.ts (PR3)
export const reportCardDefinitionSectionConfig: EntityConfigFactory<ReportCardDefinitionSection> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sections,
    tenant: reportCardSectionTenant(),
    read: read(operationModule(ReportCardOperations.read), noopReadAccess),
    write: write(operationModule(AcademicsOperations.examConfigure), authorizeReportCardSection(policy), authorizeReportCardSectionDelete(policy)),
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
  _existing: ReportCardDefinitionSection | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const definition = await repositories.definitions.findById(section.reportCardDefinitionId)
  if (!definition) {
    denyResourceAccess()
  }
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

export function authorizeReportCardSection(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeSave'] {
  return noopSaveAccess
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

export function authorizeReportCardSectionDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeDelete'] {
  return noopDeleteAccess
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
