import type { ClassStaffAssignment } from '$lib/core/entities/administration/class-staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassStaffAssignmentRepository extends BaseRepositoryInterface<ClassStaffAssignment> {
  listByStaff: (staffId: string) => Promise<ClassStaffAssignment[]>
  listByClassroom: (classroomId: string) => Promise<ClassStaffAssignment[]>
}
