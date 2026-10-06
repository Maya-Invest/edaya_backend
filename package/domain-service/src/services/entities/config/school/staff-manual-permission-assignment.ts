import type { StaffManualPermissionAssignment } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const staffManualPermissionAssignmentConfig: EntityConfigFactory<StaffManualPermissionAssignment> = ({ repositories, atomicExecution }) => config({
  repository: repositories.staffManualPermissionAssignments,
  tenant: directSchoolTenant(),
  resource: 'staffManualPermissionAssignments',
  atomicExecution,
})
