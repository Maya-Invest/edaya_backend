import type { AuthorizationPolicy } from '../../../authorization'
import type { ResourceAssignment } from '../../../entities/school/resource-assignment'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, indirectTenant, noopReadAccess, read, write } from '../../../shared'

export const resourceAssignmentConfig: EntityConfigFactory<ResourceAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.resourceAssignments,
    tenant: resourceAssignmentTenant(),
    read: read(action(policy, 'resources.read'), noopReadAccess),
    write: write(action(policy, 'resources.manage'), authorizeResourceAssignment(policy), authorizeResourceAssignmentDelete(policy)),
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
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

function authorizeResourceAssignmentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ResourceAssignment>['authorizeDelete'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
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
  if (assignment.sessionId) {
    const session = await repositories.sessions.findById(assignment.sessionId)
    if (!session) {
      denyResourceAccess()
    }
    const classGroup = await repositories.classGroups.findById(session.classGroupId)
    if (!classGroup || classGroup.schoolId !== resource.schoolId) {
      denyResourceAccess()
    }
    await ensureResourceCanBeAssignedToSession(assignment, session, repositories)
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

async function ensureResourceCanBeAssignedToSession(
  assignment: ResourceAssignment,
  session: { id: string, classGroupId: string, startsAt: Date, endsAt: Date },
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.resourceAssignments.list({ resourceId: assignment.resourceId })
  for (const existing of assignments) {
    if (existing.id === assignment.id) {
      continue
    }
    if (existing.sessionId === assignment.sessionId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_SESSION', `Resource ${assignment.resourceId} is already assigned to session ${assignment.sessionId}`)
    }
    if (existing.classGroupId && existing.classGroupId !== session.classGroupId) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${assignment.resourceId} is already assigned to class ${existing.classGroupId}`)
    }
    if (!existing.sessionId) {
      continue
    }
    const existingSession = await repositories.sessions.findById(existing.sessionId)
    if (!existingSession) {
      denyResourceAccess()
    }
    if (sessionsOverlap(session, existingSession)) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_OVERLAPPING', `Resource ${assignment.resourceId} is already assigned to overlapping session ${existingSession.id}`)
    }
  }
}

function sessionsOverlap(
  left: { startsAt: Date, endsAt: Date },
  right: { startsAt: Date, endsAt: Date },
): boolean {
  return left.startsAt.getTime() < right.endsAt.getTime()
    && right.startsAt.getTime() < left.endsAt.getTime()
}
