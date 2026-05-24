import type { ClassGroup } from '$lib/core/entities/school/class-group'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassGroupRepository extends BaseRepositoryInterface<ClassGroup> {
  listByAcademicYear: (academicYearId: string) => Promise<ClassGroup[]>
}
