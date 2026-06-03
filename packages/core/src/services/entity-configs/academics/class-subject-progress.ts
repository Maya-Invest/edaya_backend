import type { AuthorizationPolicy } from '../../../authorization/authorization-policy'
import type { ClassSubjectProgress } from '../../../entities/academics/class-subject-progress'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { action, config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, resolveClassSubjectSchoolId, write } from '../../../shared'

export const classSubjectProgressConfig: EntityConfigFactory<ClassSubjectProgress> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectProgress,
    tenant: classSubjectProgressTenant(),
    read: read(action(policy, 'academics.read_progress'), noopReadAccess),
    write: write(action(policy, 'academics.record_progress'), authorizeClassSubjectProgress(policy), authorizeClassSubjectProgressDelete(policy)),
    atomicExecution,
  })

function classSubjectProgressTenant(): EntityTenantResolver<ClassSubjectProgress> {
  return indirectTenant(async (entity, repositories) => {
    const matter = await repositories.classSubjectMatters.findById(entity.classSubjectMatterId)
    return matter ? resolveClassSubjectSchoolId(repositories, matter.classSubjectId) : undefined
  })
}

function authorizeClassSubjectProgress(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeClassSubjectProgressDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeDelete'] {
  return noopDeleteAccess
}
