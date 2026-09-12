import { Permission } from '@edaya/core';

import type { ClassSubjectMatter } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { config } from '../../entity-config';
import { indirectTenant, resolveClassSubjectSchoolId } from '../../entity-config/tenant';

// Extracted from domain/academics/class-subject-matter.ts (PR3)
export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    authorization: { resource: 'classSubjectMatters', read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.QUERY_CURRICULUM_PROGRESS_READ], write: [Permission.ACADEMIC_PROGRAM_UPDATE] },
    
    gates: {
      preSave: validateClassSubjectMatterSave,
    },
    atomicExecution,
  })

function classSubjectMatterTenant(): EntityTenantResolver<ClassSubjectMatter> {
  return indirectTenant(async (entity, repositories) => resolveClassSubjectSchoolId(repositories, entity.classSubjectId))
}

async function validateClassSubjectMatterSave(
  classSubjectMatter: ClassSubjectMatter,
  _existing: ClassSubjectMatter | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!repositories.classSubjects || !repositories.subjectMatters) {
    return
  }
  const [classSubject, subjectMatter] = await Promise.all([
    repositories.classSubjects.findById(classSubjectMatter.classSubjectId),
    repositories.subjectMatters.findById(classSubjectMatter.subjectMatterId),
  ])
  if (!classSubject || !subjectMatter || subjectMatter.subjectId !== classSubject.subjectId) {
    denyResourceAccess()
  }
}
