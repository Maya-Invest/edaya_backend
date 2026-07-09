import type { Attendance } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'
import { SchedulingOperations } from '@edaya/authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/attendance.ts (PR3)
export const attendanceConfig: EntityConfigFactory<Attendance> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.attendances,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(operationModule(SchedulingOperations.timetableRead), noopReadAccess),
    write: write(
      operationModule(SchedulingOperations.timetableManage),
      authorizeClassGroupLinked(policy, 'classGroupId'),
      authorizeClassGroupLinkedDelete(policy),
    ),
    atomicExecution,
  })
