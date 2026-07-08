import type { StaffPermissionAssignment } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { AccessControlOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/staff-permission-assignment.ts (PR3)
export const staffPermissionAssignmentConfig: EntityConfigFactory<StaffPermissionAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionAssignments,
    tenant: directSchoolTenant(),
    read: read(operationModule(AccessControlOperations.read), noopReadAccess),
    write: write(
      operationModule(AccessControlOperations.assign),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  })
