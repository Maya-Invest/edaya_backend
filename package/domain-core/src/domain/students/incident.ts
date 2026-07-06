import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, dateTime, directSchoolTenant, disciplineCreateModule, disciplineReadModule, noopReadAccess, read, write } from '../../application/entities/entity-config'
import {
  assertHomeroomCapability,
  assertTeachingCapability,
  AuthorizationError,
  AuthorizationErrorCode,
  HomeroomCapability,
  TeachingCapability,
} from '../../capabilities/authorization'
import { AttachmentOwnerKind } from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum IncidentKind {
  Positive = 'positive',
  MinorInfraction = 'minor_infraction',
  MajorInfraction = 'major_infraction',
  Emergency = 'emergency',
}

export enum IncidentStatus {
  Open = 'open',
  Resolved = 'resolved',
  Cancelled = 'cancelled',
}

export const incidentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank'),
  date: zodDate(),
  kind: z.nativeEnum(IncidentKind),
  reporterId: z.string().trim().min(1, 'reporterId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(IncidentStatus).default(IncidentStatus.Open),
  resolutionNotes: z.string().trim().min(1, 'resolutionNotes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  resolvedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  resolvedByStaffId: z.string().trim().min(1, 'resolvedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineIncident(data: any, ctx: z.RefinementCtx) {
  if ((data.resolvedAt && !data.resolvedByStaffId) || (!data.resolvedAt && data.resolvedByStaffId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'resolvedAt and resolvedByStaffId must be provided together',
    })
  }
  if (data.status === IncidentStatus.Resolved && !data.resolvedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'resolvedAt is required for resolved incidents',
    })
  }
  if (data.status === IncidentStatus.Open && (data.resolvedAt || data.resolvedByStaffId || data.resolutionNotes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'open incidents must not define resolution fields',
    })
  }
  if (data.updatedAt.getTime() < data.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
    })
  }
}

export const incidentSchema = incidentBaseSchema.superRefine(refineIncident)

export type IncidentData = z.infer<typeof incidentSchema>
export type IncidentInput = z.input<typeof incidentSchema>

export const incidentCreateSchema = incidentBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineIncident)
export const incidentUpdateSchema = incidentBaseSchema.partial().required({ id: true }).superRefine(refineIncident)

/**
 * Represents a logged behavior event, which can be positive (merit/award)
 * or negative (infraction/emergency).
 */
export class Incident {
  readonly data: IncidentData

  constructor(args: IncidentInput) {
    this.data = parseDomain(incidentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get title() { return this.data.title }
  get description() { return this.data.description }
  get date() { return this.data.date }
  get kind() { return this.data.kind }
  get reporterId() { return this.data.reporterId }
  get classGroupId() { return this.data.classGroupId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get status() { return this.data.status }
  get resolutionNotes() { return this.data.resolutionNotes }
  get resolvedAt() { return this.data.resolvedAt }
  get resolvedByStaffId() { return this.data.resolvedByStaffId }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export const incidentConfig: EntityConfigFactory<Incident> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.incidents,
    tenant: directSchoolTenant(),
    read: read(disciplineReadModule(), noopReadAccess),
    write: write(disciplineCreateModule(), authorizeIncident(policy), authorizeIncidentDelete(policy)),
    gates: {
      preSave: validateIncidentSave,
      preDelete: validateIncidentDelete,
    },
    atomicExecution,
  })

function authorizeIncident(policy: AuthorizationPolicy): EntityWriteAuthorization<Incident>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    if (actor.kind === 'teacher') {
      if (entity.lessonSessionId) {
        const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
        if (!lessonSession) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
        assertTeachingCapability(actor, TeachingCapability.CreateSubjectDisciplineIncident, {
          classSubjectId: lessonSession.classSubjectId,
        })
        return
      }
      if (entity.classGroupId) {
        assertHomeroomCapability(actor, HomeroomCapability.CreateClassDisciplineIncident, {
          classGroupId: entity.classGroupId,
        })
        return
      }
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

function authorizeIncidentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<Incident>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    if (actor.kind === 'teacher') {
      if (entity.lessonSessionId) {
        const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
        if (!lessonSession) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
        assertTeachingCapability(actor, TeachingCapability.CreateSubjectDisciplineIncident, {
          classSubjectId: lessonSession.classSubjectId,
        })
        return
      }
      if (entity.classGroupId) {
        assertHomeroomCapability(actor, HomeroomCapability.CreateClassDisciplineIncident, {
          classGroupId: entity.classGroupId,
        })
        return
      }
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
  }
}

async function validateIncidentSave(
  entity: Incident,
  existing: Incident | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await validateIncidentScope(entity, repositories)
  if (!existing)
    return

  const resolvesIncident = existing.status !== IncidentStatus.Resolved
    && entity.status === IncidentStatus.Resolved
  if (resolvesIncident && existing.status !== IncidentStatus.Open) {
    throw new BusinessRuleViolationError('INCIDENT_NOT_OPEN', `Incident ${existing.id} is not open`)
  }
  if (
    existing.status === IncidentStatus.Resolved
    && entity.status === IncidentStatus.Resolved
    && incidentResolutionChanged(entity, existing)
  ) {
    throw new BusinessRuleViolationError('INCIDENT_ALREADY_RESOLVED', `Incident ${existing.id} is already resolved`)
  }
}

async function validateIncidentScope(entity: Incident, repositories: SchoolRepositories): Promise<void> {
  if (entity.lessonSessionId) {
    const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
    const classGroup = lessonSession ? await repositories.classGroups.findById(lessonSession.classGroupId) : undefined
    if (
      !lessonSession
      || !classGroup
      || classGroup.schoolId !== entity.schoolId
      || (entity.classGroupId && classGroup.id !== entity.classGroupId)
    ) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }
  if (entity.classGroupId) {
    const classGroup = await repositories.classGroups.findById(entity.classGroupId)
    if (!classGroup || classGroup.schoolId !== entity.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

function incidentResolutionChanged(entity: Incident, existing: Incident): boolean {
  return entity.resolutionNotes !== existing.resolutionNotes
    || dateTime(entity.resolvedAt) !== dateTime(existing.resolvedAt)
    || entity.resolvedByStaffId !== existing.resolvedByStaffId
}

async function validateIncidentDelete(
  incident: Incident,
  repositories: SchoolRepositories,
): Promise<void> {
  const [involvements, actions, attachments] = await Promise.all([
    repositories.studentIncidentInvolvements.list({ incidentId: incident.id }),
    repositories.studentDisciplinaryActions.list({ incidentId: incident.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Incident, ownerId: incident.id }),
  ])
  if (involvements.length > 0 || actions.length > 0 || attachments.length > 0) {
    throw new BusinessRuleViolationError('INCIDENT_HAS_DEPENDENCIES', `Cannot delete incident ${incident.id}: dependent records still exist`)
  }
}
