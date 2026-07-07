import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, indirectTenant, noopReadAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, ResourceOperations } from '../../capabilities/authorization'

import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const resourceAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  resourceId: z.string().trim().min(1, 'resourceId must not be blank'),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activitySessionId: z.string().trim().min(1, 'activitySessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineResourceAssignment(
  data: {
    lessonSessionId?: string
    activitySessionId?: string
    assessmentId?: string
    classGroupId?: string
  },
  ctx: z.RefinementCtx,
) {
  const targets = [data.lessonSessionId, data.activitySessionId, data.assessmentId, data.classGroupId].filter(Boolean)
  if (targets.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A ResourceAssignment must target exactly one of: lessonSessionId, activitySessionId, assessmentId, or classGroupId',
    })
  }
}

export const resourceAssignmentSchema = resourceAssignmentBaseSchema.superRefine(refineResourceAssignment)
export type ResourceAssignmentData = z.infer<typeof resourceAssignmentSchema>
export type ResourceAssignmentInput = z.input<typeof resourceAssignmentSchema>

export const resourceAssignmentCreateSchema = resourceAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineResourceAssignment)
export const resourceAssignmentUpdateSchema = resourceAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineResourceAssignment)

/**
 * Assigns a specific Resource (like a room or equipment) to a lesson occurrence or ClassGroup.
 */
export class ResourceAssignment {
  readonly data: ResourceAssignmentData

  constructor(args: ResourceAssignmentInput) {
    this.data = parseDomain(resourceAssignmentSchema, args)
  }

  get id() { return this.data.id }
  get resourceId() { return this.data.resourceId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get activitySessionId() { return this.data.activitySessionId }
  get assessmentId() { return this.data.assessmentId }
  get classGroupId() { return this.data.classGroupId }
  get createdAt() { return this.data.createdAt }
}

export const resourceAssignmentConfig: EntityConfigFactory<ResourceAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.resourceAssignments,
    tenant: resourceAssignmentTenant(),
    read: read(operationModule(ResourceOperations.read), noopReadAccess),
    write: write(operationModule(ResourceOperations.configure), authorizeResourceAssignment(policy), authorizeResourceAssignmentDelete(policy)),
    gates: {
      preSave: validateResourceAssignmentSave,
    },
    atomicExecution,
  })

function resourceAssignmentTenant(): EntityTenantResolver<ResourceAssignment> {
  return indirectTenant(async (entity, repositories) => {
    const resource = await repositories.resources.findById(entity.resourceId)
    return resource?.schoolId
  })
}

function authorizeResourceAssignment(policy: AuthorizationPolicy): EntityWriteAuthorization<ResourceAssignment>['authorizeSave'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
    if (entity.activitySessionId)
      await policy.checkActivitySessionAccess(actor, [entity.activitySessionId])
    if (entity.assessmentId)
      await policy.checkAssessmentAccess(actor, [entity.assessmentId])
  }
}

function authorizeResourceAssignmentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ResourceAssignment>['authorizeDelete'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
    if (entity.activitySessionId)
      await policy.checkActivitySessionAccess(actor, [entity.activitySessionId])
    if (entity.assessmentId)
      await policy.checkAssessmentAccess(actor, [entity.assessmentId])
  }
}

async function validateResourceAssignmentSave(
  assignment: ResourceAssignment,
  _existing: ResourceAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const resource = await repositories.resources.findById(assignment.resourceId)
  if (!resource) {
    denyResourceAccess()
  }
  if (assignment.classGroupId) {
    const classGroup = await repositories.classGroups.findById(assignment.classGroupId)
    if (!classGroup || classGroup.schoolId !== resource.schoolId) {
      denyResourceAccess()
    }
    await ensureResourceCanBeAssignedToClass(assignment, repositories)
    return
  }
  if (assignment.lessonSessionId) {
    const lessonSession = await repositories.lessonSessions.findById(assignment.lessonSessionId)
    if (!lessonSession) {
      denyResourceAccess()
    }
    const classGroup = await repositories.classGroups.findById(lessonSession.classGroupId)
    if (!classGroup || classGroup.schoolId !== resource.schoolId) {
      denyResourceAccess()
    }
    await ensureResourceCanBeAssignedToLessonSession(assignment, lessonSession, repositories)
    return
  }
  if (assignment.activitySessionId) {
    const activitySession = await repositories.activitySessions.findById(assignment.activitySessionId)
    if (!activitySession) {
      denyResourceAccess()
    }
    const classGroup = await repositories.classGroups.findById(activitySession.classGroupId)
    if (!classGroup || classGroup.schoolId !== resource.schoolId) {
      denyResourceAccess()
    }
    await ensureResourceCanBeAssignedToActivitySession(assignment, activitySession, repositories)
  }
}

async function ensureResourceCanBeAssignedToClass(
  assignment: ResourceAssignment,
  repositories: SchoolRepositories,
): Promise<void> {
  const classAssignments = await repositories.resourceAssignments.list({
    resourceId: assignment.resourceId,
    classGroupId: { $exists: true },
  })
  const duplicate = classAssignments.find(existing =>
    existing.id !== assignment.id && existing.classGroupId === assignment.classGroupId)
  if (duplicate) {
    throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${assignment.resourceId} is already assigned to class ${assignment.classGroupId}`)
  }
  const conflicting = classAssignments.find(existing =>
    existing.id !== assignment.id && existing.classGroupId !== assignment.classGroupId)
  if (conflicting) {
    throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${assignment.resourceId} is already assigned to class ${conflicting.classGroupId}`)
  }
}

async function ensureResourceCanBeAssignedToActivitySession(
  assignment: ResourceAssignment,
  activitySession: { id: string, classGroupId: string, startsAt: Date, endsAt: Date },
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.resourceAssignments.list({ resourceId: assignment.resourceId })
  for (const existing of assignments) {
    if (existing.id === assignment.id) {
      continue
    }
    if (existing.activitySessionId === assignment.activitySessionId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_ACTIVITY_SESSION', `Resource ${assignment.resourceId} is already assigned to activity session ${assignment.activitySessionId}`)
    }
    if (existing.classGroupId && existing.classGroupId !== activitySession.classGroupId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${assignment.resourceId} is already assigned to class ${existing.classGroupId}`)
    }
    if (!existing.activitySessionId && !existing.lessonSessionId) {
      continue
    }
    const existingOccurrence = existing.lessonSessionId
      ? await repositories.lessonSessions.findById(existing.lessonSessionId)
      : existing.activitySessionId
        ? await repositories.activitySessions.findById(existing.activitySessionId)
        : undefined
    if (!existingOccurrence) {
      denyResourceAccess()
    }
    if (occurrencesOverlap(activitySession, existingOccurrence)) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_OVERLAPPING', `Resource ${assignment.resourceId} is already assigned to overlapping occurrence ${existingOccurrence.id}`)
    }
  }
}

async function ensureResourceCanBeAssignedToLessonSession(
  assignment: ResourceAssignment,
  lessonSession: { id: string, classGroupId: string, startsAt: Date, endsAt: Date },
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.resourceAssignments.list({ resourceId: assignment.resourceId })
  for (const existing of assignments) {
    if (existing.id === assignment.id) {
      continue
    }
    if (existing.lessonSessionId === assignment.lessonSessionId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_LESSON_SESSION', `Resource ${assignment.resourceId} is already assigned to lesson session ${assignment.lessonSessionId}`)
    }
    if (existing.classGroupId && existing.classGroupId !== lessonSession.classGroupId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${assignment.resourceId} is already assigned to class ${existing.classGroupId}`)
    }
    if (!existing.lessonSessionId) {
      continue
    }
    const existingLessonSession = await repositories.lessonSessions.findById(existing.lessonSessionId)
    if (!existingLessonSession) {
      denyResourceAccess()
    }
    if (occurrencesOverlap(lessonSession, existingLessonSession)) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_OVERLAPPING', `Resource ${assignment.resourceId} is already assigned to overlapping lesson session ${existingLessonSession.id}`)
    }
  }
}

function occurrencesOverlap(
  left: { startsAt: Date, endsAt: Date },
  right: { startsAt: Date, endsAt: Date },
): boolean {
  return left.startsAt.getTime() < right.endsAt.getTime()
    && right.startsAt.getTime() < left.endsAt.getTime()
}
