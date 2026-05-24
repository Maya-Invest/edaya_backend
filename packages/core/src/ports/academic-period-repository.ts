import type { AcademicPeriod } from '$lib/core/entities/school/academic-period'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AcademicPeriodRepository extends BaseRepositoryInterface<AcademicPeriod> {
  listByAcademicYear: (academicYearId: string) => Promise<AcademicPeriod[]>
  listBySchool: (schoolId: string) => Promise<AcademicPeriod[]>
}
