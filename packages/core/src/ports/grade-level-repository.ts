import type { GradeLevel } from '$lib/core/entities/school/grade-level'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GradeLevelRepository extends BaseRepositoryInterface<GradeLevel> {
  listBySchool: (schoolId: string) => Promise<GradeLevel[]>
}
