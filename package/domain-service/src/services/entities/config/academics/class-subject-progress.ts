import type { ClassSubjectProgress } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'

import { indirectTenant, resolveClassSubjectSchoolId } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject-progress.ts (PR3)
export const classSubjectProgressConfig: EntityConfigFactory<ClassSubjectProgress> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.classSubjectProgress,
    tenant: classSubjectProgressTenant(),
    resource: 'classSubjectProgress',
    writeLockGroup: 'academic-state',

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

export async function validateClassSubjectProgressSave(
  progress: ClassSubjectProgress,
  _existing: ClassSubjectProgress | undefined,
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
}
