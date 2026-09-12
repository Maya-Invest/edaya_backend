import { Permission } from '@edaya/core';

import type { ResourceAssignment } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { indirectTenant } from '../../entity-config/tenant';

// Extracted from domain/school/resource-assignment.ts (PR3)
export const resourceAssignmentConfig: EntityConfigFactory<ResourceAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.resourceAssignments,
    tenant: resourceAssignmentTenant(),
    authorization: { resource: 'resourceAssignments', read: [Permission.RESOURCE_READ], write: [Permission.RESOURCE_CONFIGURE] },
    
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
