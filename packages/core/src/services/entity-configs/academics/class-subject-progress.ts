import type { AuthorizationPolicy } from '../../../authorization/authorization-policy'
import type { ClassSubjectProgress } from '../../../entities/academics/class-subject-progress'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess, Permission } from '../../../authorization'
import { config, indirectTenant, permissionAction, read, resolveClassSubjectSchoolId, unique, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const classSubjectProgressConfig: EntityConfigFactory<ClassSubjectProgress> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectProgress,
    tenant: classSubjectProgressTenant(),
    read: read(permissionAction(policy, Permission.CLASS_LOGBOOK_READ), async (actor, entities) => {
      await policy.checkSessionAccess(actor, unique(entities.map(entity => entity.sessionId)))
    }),
    write: write(permissionAction(policy, Permission.CLASS_LOGBOOK_CREATE), authorizeClassSubjectProgress(policy), authorizeClassSubjectProgressDelete(policy)),
    gates: {
      preSave: validateClassSubjectProgressSave,
    },
    atomicExecution,
  })

function classSubjectProgressTenant(): EntityTenantResolver<ClassSubjectProgress> {
  return indirectTenant(async (entity, repositories) => {
    const matter = await repositories.classSubjectMatters.findById(entity.classSubjectMatterId)
    return matter ? resolveClassSubjectSchoolId(repositories, matter.classSubjectId) : undefined
  })
}

function authorizeClassSubjectProgress(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeSave'] {
  return async (actor, entity) => {
    await _policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

function authorizeClassSubjectProgressDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeDelete'] {
  return async (actor, entity) => {
    await _policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

async function validateClassSubjectProgressSave(
  progress: ClassSubjectProgress,
  existing: ClassSubjectProgress | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [matter, session] = await Promise.all([
    repositories.classSubjectMatters.findById(progress.classSubjectMatterId),
    repositories.sessions.findById(progress.sessionId),
  ])
  if (!matter || !session) {
    denyResourceAccess()
  }
  const classSubject = await repositories.classSubjects.findById(matter.classSubjectId)
  if (!classSubject || classSubject.classGroupId !== session.classGroupId || session.classSubjectId !== classSubject.id) {
    denyResourceAccess()
  }
  const duplicate = await repositories.classSubjectProgress.findOne({
    classSubjectMatterId: progress.classSubjectMatterId,
    sessionId: progress.sessionId,
  })
  if (duplicate && duplicate.id !== progress.id) {
    throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', `Progress has already been recorded for matter ${progress.classSubjectMatterId} and session ${progress.sessionId}`)
  }
  const previousPercentage = existing?.completedPercentage ?? matter.completedPercentage
  if (progress.completedPercentage < previousPercentage) {
    throw new BusinessRuleViolationError('PROGRESS_PERCENTAGE_DECREASED', 'completedPercentage must not decrease cumulative class subject matter progress')
  }
}
