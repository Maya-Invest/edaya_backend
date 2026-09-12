import { Permission } from '@edaya/core';
import type { GradeLevel } from '@edaya/core';
import type { EntityConfigFactory } from '../../entity-config';

import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/school/grade-level.ts (PR3)
export const gradeLevelConfig: EntityConfigFactory<GradeLevel> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevels,
    tenant: directSchoolTenant(),
    authorization: { resource: 'gradeLevels', read: [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_UPDATE, Permission.QUERY_CLASS_DIRECTORY_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.ATTENDANCE_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
    
    atomicExecution,
  })
