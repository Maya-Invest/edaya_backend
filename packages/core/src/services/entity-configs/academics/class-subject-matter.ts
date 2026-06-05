import type { AuthorizationPolicy } from '../../../authorization'
import type { ClassSubjectMatter } from '../../../entities/academics/class-subject-matter'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { Permission } from '../../../authorization'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveClassSubjectSchoolId, write } from '../../../shared'

export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    read: read(permissionAction(policy, Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACADEMIC_PROGRAM_UPDATE), authorizeClassSubjectMatter(policy), authorizeClassSubjectMatterDelete(policy)),
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
