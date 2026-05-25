import type { PeriodDefinition } from '../entities/scheduling/period-definition'
import type { BaseRepositoryInterface } from './_base-repository'

export interface PeriodDefinitionRepository extends BaseRepositoryInterface<PeriodDefinition> {
  listByAcademicYear: (academicYearId: string) => Promise<PeriodDefinition[]>
}
