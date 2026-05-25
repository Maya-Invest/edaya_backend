import type { Schedule } from '../entities/scheduling/schedule'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ScheduleRepository extends BaseRepositoryInterface<Schedule> {
  listByClassGroup: (classGroupId: string) => Promise<Schedule[]>
}
