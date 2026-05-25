import type { Session } from '../entities/scheduling/session'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SessionRepository extends BaseRepositoryInterface<Session> {
  listByClassGroup: (classGroupId: string) => Promise<Session[]>
  listBetween: (startDate: Date, endDate: Date) => Promise<Session[]>
}
