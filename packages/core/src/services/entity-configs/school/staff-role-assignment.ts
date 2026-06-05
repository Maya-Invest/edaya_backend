import type { StaffRoleAssignment } from '../../../entities/school/staff-role-assignment'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'

export const staffRoleAssignmentConfig: EntityConfigFactory<StaffRoleAssignment> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.staffRoleAssignments,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_ASSIGN,
  )
