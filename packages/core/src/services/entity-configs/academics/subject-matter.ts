import type { AuthorizationPolicy } from '../../../authorization/authorization-policy'
import type { SubjectMatter } from '../../../entities/academics/subject-matter'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { Permission } from '../../../authorization'
import { AuthorizationError, AuthorizationErrorCode } from '../../../authorization/authorization-error'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, permissionAction, read, write } from '../../../shared'

export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    read: read(permissionAction(policy, Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACADEMIC_PROGRAM_UPDATE), authorizeSubjectMatter(policy), authorizeSubjectMatterDelete(policy)),
    atomicExecution,
  })

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}

function authorizeSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    if (!subject || subject.schoolId !== actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function authorizeSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}
