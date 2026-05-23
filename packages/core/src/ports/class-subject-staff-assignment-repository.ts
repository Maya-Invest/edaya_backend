import type { ClassSubjectStaffAssignment } from '$lib/core/entities/administration/class-subject-staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectStaffAssignmentRepository extends BaseRepositoryInterface<ClassSubjectStaffAssignment> {
  listByStaff: (staffId: string) => Promise<ClassSubjectStaffAssignment[]>
  listByClassSubject: (classSubjectId: string) => Promise<ClassSubjectStaffAssignment[]>
}
