import type { ReportCardDefinition } from '$lib/core/entities/assessments/report-card-definition'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ReportCardDefinitionRepository extends BaseRepositoryInterface<ReportCardDefinition> {
  findDefaultByGradeLevel: (
    gradeLevelId: string,
    academicYearId: string,
  ) => Promise<ReportCardDefinition | undefined>
  listByGradeLevel: (gradeLevelId: string, academicYearId: string) => Promise<ReportCardDefinition[]>
}
