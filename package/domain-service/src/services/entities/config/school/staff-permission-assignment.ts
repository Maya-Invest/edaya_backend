import { Permission } from '@edaya/core';
import type { StaffPermissionAssignment } from '@edaya/core';
import type { EntityConfigFactory } from '../../entity-config';

import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/school/staff-permission-assignment.ts (PR3)
export const staffPermissionAssignmentConfig: EntityConfigFactory<StaffPermissionAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionAssignments,
    tenant: directSchoolTenant(),
    authorization: { resource: 'staffPermissionAssignments', read: [Permission.ACCESS_CONTROL_READ], write: [Permission.ACCESS_CONTROL_ASSIGN] },
    
    atomicExecution,
  })
