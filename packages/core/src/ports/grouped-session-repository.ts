import type { GroupedSession } from '$lib/core/entities/scheduling/grouped-session'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GroupedSessionRepository extends BaseRepositoryInterface<GroupedSession> {
  listByAcademicYear: (academicYearId: string) => Promise<GroupedSession[]>
  listBetween: (startDate: Date, endDate: Date) => Promise<GroupedSession[]>
}
