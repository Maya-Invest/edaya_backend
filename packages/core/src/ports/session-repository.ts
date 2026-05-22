import type { Session } from '$lib/core/entities/scheduling/session'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SessionRepository extends BaseRepositoryInterface<Session> {
  listByClassroom: (classroomId: string) => Promise<Session[]>
  listBetween: (startDate: Date, endDate: Date) => Promise<Session[]>
}
