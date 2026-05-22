import type { AttendanceRecord } from '$lib/core/entities/attendance-record'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AttendanceRepository extends BaseRepositoryInterface<AttendanceRecord> {
  findByStudentAndSession: (
    studentId: string,
    sessionId: string,
  ) => Promise<AttendanceRecord | undefined>
  listBySession: (sessionId: string) => Promise<AttendanceRecord[]>
  listByStudentBetween: (studentId: string, startDate: Date, endDate: Date) => Promise<AttendanceRecord[]>
}
