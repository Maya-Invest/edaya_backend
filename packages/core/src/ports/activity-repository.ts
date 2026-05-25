import type { Activity } from '../entities/students/activity'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ActivityRepository extends BaseRepositoryInterface<Activity> {
  listByAcademicYear: (academicYearId: string) => Promise<Activity[]>
}
