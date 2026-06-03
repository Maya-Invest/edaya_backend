import type { AuthorizationPolicy } from '../../../authorization'
import type { ReportCardDefinitionSection } from '../../../entities/assessments/report-card-definition-section'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { ReportCardDefinitionSectionKind } from '../../../entities/assessments/report-card-definition-section'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared/common'

export const reportCardDefinitionSectionConfig: EntityConfigFactory<ReportCardDefinitionSection> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sections,
    tenant: reportCardSectionTenant(),
    read: read(action(policy, 'queries.read_report_card_detail'), noopReadAccess),
    write: write(action(policy, 'assessments.manage_configuration'), authorizeReportCardSection(policy), authorizeReportCardSectionDelete(policy)),
    gates: {
      preSave: validateReportCardSectionSave,
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
