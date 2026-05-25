import type { AcademicYear } from '../entities/school/academic-year'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AcademicYearRepository extends BaseRepositoryInterface<AcademicYear> {
  listBySchool: (schoolId: string) => Promise<AcademicYear[]>
}
