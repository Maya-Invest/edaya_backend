import type { AcademicYear } from '$lib/core/entities/academic-year'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AcademicYearRepository extends BaseRepositoryInterface<AcademicYear> {
  listBySchool: (schoolId: string) => Promise<AcademicYear[]>
}
