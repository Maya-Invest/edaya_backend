import type { AuthorizationPolicy } from '../../authorization/authorization-policy'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, permissionAction, read, resolveClassSubjectSchoolId, unique, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { parseDomain, zodDate } from '../utils'
import { ClassSubjectMatterStatus } from './class-subject-matter'

export const classSubjectProgressSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classSubjectMatterId: z.string().trim().min(1, 'classSubjectMatterId must not be blank'),
  sessionId: z.string().trim().min(1, 'sessionId must not be blank'),
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
 * Captures a class subject matter's cumulative progress at the end of a session.
 * Multiple records provide the daily progression history while ClassSubjectMatter
 * retains the current aggregate state.
 */
export class ClassSubjectProgress {
  readonly data: ClassSubjectProgressData

  constructor(args: ClassSubjectProgressInput) {
    this.data = parseDomain(classSubjectProgressSchema, args)
  }

  get id() { return this.data.id }
  get classSubjectMatterId() { return this.data.classSubjectMatterId }
  get sessionId() { return this.data.sessionId }
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
