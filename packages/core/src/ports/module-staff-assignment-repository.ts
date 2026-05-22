import type { ModuleStaffAssignment } from '$lib/core/entities/module-staff-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ModuleStaffAssignmentRepository extends BaseRepositoryInterface<ModuleStaffAssignment> {
  listByStaff: (staffId: string) => Promise<ModuleStaffAssignment[]>
  listByModule: (moduleId: string) => Promise<ModuleStaffAssignment[]>
}
