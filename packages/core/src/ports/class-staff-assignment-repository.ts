import type { StaffAssignment } from '$lib/core/entities/administration/staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassStaffAssignmentRepository extends BaseRepositoryInterface<StaffAssignment> {
  listByStaff: (staffId: string) => Promise<StaffAssignment[]>
  listByClassGroup: (classGroupId: string) => Promise<StaffAssignment[]>
}
