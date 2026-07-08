import type { AuthorizationPolicy } from '@edaya/authorization'
import type { ClassSubjectMatter } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AcademicsOperations, denyResourceAccess } from '@edaya/authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'
import { indirectTenant, resolveClassSubjectSchoolId } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject-matter.ts (PR3)
export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    read: read(operationModule(AcademicsOperations.curriculumRead), noopReadAccess),
    write: write(operationModule(AcademicsOperations.programUpdate), authorizeClassSubjectMatter(policy), authorizeClassSubjectMatterDelete(policy)),
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

function authorizeClassSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeClassSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}
