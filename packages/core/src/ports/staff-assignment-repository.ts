import type { StaffAssignment } from '../entities/school/staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StaffAssignmentRepository extends BaseRepositoryInterface<StaffAssignment> {
  listByStaff: (staffId: string) => Promise<StaffAssignment[]>
  listByClassGroup: (classGroupId: string) => Promise<StaffAssignment[]>
  listByClassSubject: (classSubjectId: string) => Promise<StaffAssignment[]>
  listBySession: (sessionId: string) => Promise<StaffAssignment[]>
  listByGroupedSession: (groupedSessionId: string) => Promise<StaffAssignment[]>
}
