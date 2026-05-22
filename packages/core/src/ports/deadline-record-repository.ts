import type { DeadlineRecord } from '$lib/core/entities/deadline-record'
import type { BaseRepositoryInterface } from './_base-repository'

export interface DeadlineRecordRepository extends BaseRepositoryInterface<DeadlineRecord> {
  findByStudentAndDeadline: (studentId: string, deadlineId: string) => Promise<DeadlineRecord | undefined>
  listByDeadline: (deadlineId: string) => Promise<DeadlineRecord[]>
  listByStudent: (studentId: string) => Promise<DeadlineRecord[]>
}
