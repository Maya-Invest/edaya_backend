import type { Attendance } from '@edaya/core'
import type { EntityConfigFactory } from '../../entity-config'

import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/attendance.ts (PR3)
export const attendanceConfig: EntityConfigFactory<Attendance> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.attendances,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'attendances',

    atomicExecution,
  })
