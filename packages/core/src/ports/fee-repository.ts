import type { Fee } from '../entities/finances/fee'
import type { BaseRepositoryInterface } from './_base-repository'

export interface FeeRepository extends BaseRepositoryInterface<Fee> {
  listBySchool: (schoolId: string) => Promise<Fee[]>
  listByAcademicYear: (academicYearId: string) => Promise<Fee[]>
}
