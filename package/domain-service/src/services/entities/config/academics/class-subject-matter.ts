import type { ClassSubjectMatter } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant, resolveClassSubjectSchoolId } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject-matter.ts (PR3)
export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    resource: 'classSubjectMatters',

    gates: {
      preSave: validateClassSubjectMatterSave,
      preDelete: validateClassSubjectMatterDelete,
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

export async function validateClassSubjectMatterDelete(matter: ClassSubjectMatter, repositories: SchoolRepositories): Promise<void> {
  if (await repositories.classSubjectProgress.findOne({ classSubjectMatterId: matter.id })) {
    throw new BusinessRuleViolationError('CLASS_SUBJECT_MATTER_HAS_PROGRESS', 'Curriculum with recorded progress cannot be deleted')
  }
}
