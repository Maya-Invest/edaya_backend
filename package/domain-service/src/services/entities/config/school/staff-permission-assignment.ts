import type { StaffPermissionAssignment } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/staff-permission-assignment.ts (PR3)
export const staffPermissionAssignmentConfig: EntityConfigFactory<StaffPermissionAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionAssignments,
    tenant: directSchoolTenant(),
    resource: 'staffPermissionAssignments',

    atomicExecution,
  })
