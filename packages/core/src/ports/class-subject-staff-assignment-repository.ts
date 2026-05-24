import type { StaffAssignment } from '$lib/core/entities/school/staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectStaffAssignmentRepository extends BaseRepositoryInterface<StaffAssignment> {
  listByStaff: (staffId: string) => Promise<StaffAssignment[]>
  listByClassSubject: (classSubjectId: string) => Promise<StaffAssignment[]>
}
