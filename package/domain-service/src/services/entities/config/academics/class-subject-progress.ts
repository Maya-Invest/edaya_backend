import type { AuthorizationPolicy } from '@edaya/authorization'
import type { ClassSubjectProgress, CoreEntityRepositories } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, LogbookOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { anyOperationModule, authorizeDeleteWithOperation, authorizeSaveWithOperation, config, read, write } from '../../entity-config'
import { unique } from '../../entity-config/helper-utils'
import { indirectTenant, resolveClassSubjectSchoolId } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject-progress.ts (PR3)
export const classSubjectProgressConfig: EntityConfigFactory<ClassSubjectProgress> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectProgress,
    tenant: classSubjectProgressTenant(),
    read: read(
      anyOperationModule([LogbookOperations.read]),
      async (actor, entities) => {
        await policy.checkLessonSessionAccess(actor, unique(entities.map(entity => entity.lessonSessionId)))
      },
    ),
    write: write(
      anyOperationModule([LogbookOperations.create, LogbookOperations.update]),
      authorizeSaveWithOperation(
        (_entity, existing) => existing ? LogbookOperations.update : LogbookOperations.create,
        resolveLogbookContext,
        authorizeClassSubjectProgressResource(policy),
      ),
      authorizeDeleteWithOperation(
        LogbookOperations.update,
        (entity, repositories) => resolveLogbookContext(entity, undefined, repositories),
        authorizeClassSubjectProgressDeleteResource(policy),
      ),
    ),
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

async function resolveLogbookContext(
  entity: ClassSubjectProgress,
  _existing: ClassSubjectProgress | undefined,
  repositories: CoreEntityRepositories,
) {
  const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
  if (!lessonSession) {
    denyResourceAccess()
  }
  return { classSubjectId: lessonSession.classSubjectId }
}

function authorizeClassSubjectProgressResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<ClassSubjectProgress>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

function authorizeClassSubjectProgressDeleteResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<ClassSubjectProgress>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

export async function validateClassSubjectProgressSave(
  progress: ClassSubjectProgress,
  existing: ClassSubjectProgress | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [matter, lessonSession] = await Promise.all([
    repositories.classSubjectMatters.findById(progress.classSubjectMatterId),
    repositories.lessonSessions.findById(progress.lessonSessionId),
  ])
  if (!matter || !lessonSession) {
    denyResourceAccess()
  }
  const classSubject = await repositories.classSubjects.findById(matter.classSubjectId)
  if (!classSubject || classSubject.classGroupId !== lessonSession.classGroupId || lessonSession.classSubjectId !== classSubject.id) {
    denyResourceAccess()
  }
  const duplicate = await repositories.classSubjectProgress.findOne({
    classSubjectMatterId: progress.classSubjectMatterId,
    lessonSessionId: progress.lessonSessionId,
  })
  if (duplicate && duplicate.id !== progress.id) {
    throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', `Progress has already been recorded for matter ${progress.classSubjectMatterId} and lesson session ${progress.lessonSessionId}`)
  }
  const previousPercentage = existing?.completedPercentage ?? matter.completedPercentage
  if (progress.completedPercentage < previousPercentage) {
    throw new BusinessRuleViolationError('PROGRESS_PERCENTAGE_DECREASED', 'completedPercentage must not decrease cumulative class subject matter progress')
  }
}
