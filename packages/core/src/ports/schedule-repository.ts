import type { Schedule } from '$lib/core/entities/scheduling/schedule'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ScheduleRepository extends BaseRepositoryInterface<Schedule> {
  listByClassGroup: (classGroupId: string) => Promise<Schedule[]>
}
