import { requireActorSchoolId } from '@edaya/authorization';
import { Permission } from '@edaya/core';

import type { SubjectMatter } from '@edaya/core';
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config';

import { config } from '../../entity-config';
import { indirectTenant } from '../../entity-config/tenant';

// Extracted from domain/academics/subject-matter.ts (PR3)
export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    authorization: { resource: 'subjectMatters', read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.QUERY_CURRICULUM_PROGRESS_READ], write: [Permission.ACADEMIC_PROGRAM_UPDATE] },
    
    atomicExecution,
  })

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}
