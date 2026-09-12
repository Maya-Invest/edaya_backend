import { Permission } from '@edaya/core';
import type { Attendance } from '@edaya/core';
import type { EntityConfigFactory } from '../../entity-config';

import { config } from '../../entity-config';
import { classGroupLinkedTenant } from '../../entity-config/tenant';

// Extracted from domain/scheduling/attendance.ts (PR3)
export const attendanceConfig: EntityConfigFactory<Attendance> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.attendances,
    tenant: classGroupLinkedTenant('classGroupId'),
    authorization: { resource: 'attendances', read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: [Permission.TIMETABLE_UPDATE] },
    
    atomicExecution,
  })
