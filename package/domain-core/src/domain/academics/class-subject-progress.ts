import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { anyPermissionAction, config, indirectTenant, permissionAction, read, resolveClassSubjectSchoolId, unique, write } from '../../application/entities/entity-config'
import { assertTeachingCapability, denyResourceAccess, Permission, TeachingCapability } from '../../capabilities/authorization'
import { LOGBOOK_ACCESS_PERMISSIONS } from '../../capabilities/authorization/policy/resolvers/permission-sets'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'
import { ClassSubjectMatterStatus } from './class-subject-matter'

export const classSubjectProgressSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classSubjectMatterId: z.string().trim().min(1, 'classSubjectMatterId must not be blank'),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank'),
  completedPercentage: z.preprocess(
    val => val === null ? undefined : val,
    z.number().min(0, 'completedPercentage must be between 0 and 100').max(100, 'completedPercentage must be between 0 and 100'),
  ),
  recordedByStaffId: z.string().trim().min(1, 'recordedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedAt: zodDate().default(() => new Date()),
})

export type ClassSubjectProgressData = z.infer<typeof classSubjectProgressSchema>
export type ClassSubjectProgressInput = z.input<typeof classSubjectProgressSchema>

export const classSubjectProgressCreateSchema = classSubjectProgressSchema.omit({ recordedAt: true })
export const classSubjectProgressUpdateSchema = classSubjectProgressSchema.partial().required({ id: true })

/**
 * Per–class-subject-matter progress snapshot for a lesson occurrence.
 */
export class ClassSubjectProgress {
  readonly data: ClassSubjectProgressData

  constructor(args: ClassSubjectProgressInput) {
    this.data = parseDomain(classSubjectProgressSchema, args)
  }

  get id() { return this.data.id }
  get classSubjectMatterId() { return this.data.classSubjectMatterId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get completedPercentage() { return this.data.completedPercentage }
  get recordedByStaffId() { return this.data.recordedByStaffId }
  get notes() { return this.data.notes }
  get recordedAt() { return this.data.recordedAt }

  get status(): ClassSubjectMatterStatus {
    if (this.completedPercentage === 0) {
      return ClassSubjectMatterStatus.NotStarted
    }
    if (this.completedPercentage === 100) {
      return ClassSubjectMatterStatus.Completed
    }
    return ClassSubjectMatterStatus.InProgress
  }
}

export const classSubjectProgressConfig: EntityConfigFactory<ClassSubjectProgress> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectProgress,
    tenant: classSubjectProgressTenant(),
    read: read(anyPermissionAction([...LOGBOOK_ACCESS_PERMISSIONS]), async (actor, entities) => {
      await policy.checkLessonSessionAccess(actor, unique(entities.map(entity => entity.lessonSessionId)))
    }),
    write: write(permissionAction(Permission.CLASS_LOGBOOK_CREATE), authorizeClassSubjectProgress(policy), authorizeClassSubjectProgressDelete(policy)),
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

function authorizeClassSubjectProgress(policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    if (actor.kind === 'teacher') {
      const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
      if (!lessonSession) {
        denyResourceAccess()
      }
      assertTeachingCapability(
        actor,
        existing ? TeachingCapability.UpdateLogbookEntry : TeachingCapability.CreateLogbookEntry,
        { classSubjectId: lessonSession.classSubjectId },
      )
      return
    }

    await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

function authorizeClassSubjectProgressDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    if (actor.kind === 'teacher') {
      const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
      if (!lessonSession) {
        denyResourceAccess()
      }
      assertTeachingCapability(actor, TeachingCapability.UpdateLogbookEntry, {
        classSubjectId: lessonSession.classSubjectId,
      })
      return
    }

    await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

async function validateClassSubjectProgressSave(
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
