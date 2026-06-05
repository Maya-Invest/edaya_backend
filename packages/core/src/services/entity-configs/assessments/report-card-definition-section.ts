import type { AuthorizationPolicy } from '../../../authorization'
import type { ReportCardDefinitionSection } from '../../../entities/assessments/report-card-definition-section'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess, Permission } from '../../../authorization'
import { ReportCardDefinitionSectionKind } from '../../../entities/assessments/report-card-definition-section'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const reportCardDefinitionSectionConfig: EntityConfigFactory<ReportCardDefinitionSection> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sections,
    tenant: reportCardSectionTenant(),
    read: read(permissionAction(policy, Permission.QUERY_REPORT_CARD_DETAIL_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.EXAM_CONFIG_CONFIGURE), authorizeReportCardSection(policy), authorizeReportCardSectionDelete(policy)),
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
