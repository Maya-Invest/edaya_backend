import type { Assessment } from '$lib/core/entities/assessments/assessment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AssessmentRepository extends BaseRepositoryInterface<Assessment> {
  listByModuleAndPeriod: (moduleId: string, periodId: string) => Promise<Assessment[]>
  listByPeriod: (periodId: string) => Promise<Assessment[]>
}
