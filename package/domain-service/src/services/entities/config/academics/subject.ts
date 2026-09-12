import { Permission } from '@edaya/core';
import type { Subject } from '@edaya/core';
import type { EntityConfigFactory } from '../../entity-config';

import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/academics/subject.ts (PR3)
export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjects,
    tenant: directSchoolTenant(),
    authorization: { resource: 'subjects', read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: [Permission.ACADEMIC_PROGRAM_UPDATE] },
    
    atomicExecution,
  })
