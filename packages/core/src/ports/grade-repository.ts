import type { Grade } from '$lib/core/entities/assessments/grade'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GradeRepository extends BaseRepositoryInterface<Grade> {
  listByStudentAndPeriod: (studentId: string, periodId: string) => Promise<Grade[]>
  listByModuleAndPeriod: (moduleId: string, periodId: string) => Promise<Grade[]>
  listByAssessment: (assessmentId: string) => Promise<Grade[]>
}
