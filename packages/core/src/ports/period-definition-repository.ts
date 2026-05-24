import type { PeriodDefinition } from '$lib/core/entities/scheduling/period-definition'
import type { BaseRepositoryInterface } from './_base-repository'

export interface PeriodDefinitionRepository extends BaseRepositoryInterface<PeriodDefinition> {
  listByAcademicYear: (academicYearId: string) => Promise<PeriodDefinition[]>
}
