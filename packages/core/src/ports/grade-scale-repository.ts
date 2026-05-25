import type { GradeScale } from '../entities/assessments/grade-scale'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GradeScaleRepository extends BaseRepositoryInterface<GradeScale> {
  findDefaultBySchool: (schoolId: string) => Promise<GradeScale | undefined>
  listBySchool: (schoolId: string) => Promise<GradeScale[]>
}
