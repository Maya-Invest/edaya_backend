import type { ReportCardDefinitionSection } from '../entities/assessments/report-card-definition-section'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ReportCardDefinitionSectionRepository extends BaseRepositoryInterface<ReportCardDefinitionSection> {
  listByReportCardDefinition: (reportCardDefinitionId: string) => Promise<ReportCardDefinitionSection[]>
}
