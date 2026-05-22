import type { Classroom } from '$lib/core/entities/classroom'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassroomRepository extends BaseRepositoryInterface<Classroom> {
  listByAcademicYear: (academicYearId: string) => Promise<Classroom[]>
}
