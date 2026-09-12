import type { AuthorizationPolicy } from '@edaya/authorization'
import type { SubjectMatter } from '@edaya/core'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AcademicsOperations, AuthorizationError, AuthorizationErrorCode, requireActorSchoolId } from '@edaya/authorization'
import { config, noopDeleteAccess, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/subject-matter.ts (PR3)
export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    read: read(operationModule(AcademicsOperations.curriculumRead), noopReadAccess),
    write: write(operationModule(AcademicsOperations.programUpdate), authorizeSubjectMatter(policy), authorizeSubjectMatterDelete(policy)),
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
    if (!subject || subject.schoolId !== requireActorSchoolId(actor))
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function authorizeSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}
