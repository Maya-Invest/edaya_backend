import type { ResourceAssignment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

export const resourceAssignmentConfig: EntityConfigFactory<ResourceAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.resourceAssignments,
    tenant: resourceAssignmentTenant(),
    resource: 'resourceAssignments',
    gates: { preSave: validateResourceAssignmentSave },
    atomicExecution,
  })

function resourceAssignmentTenant(): EntityTenantResolver<ResourceAssignment> {
  return indirectTenant(async (entity, repositories) => {
    const resource = await repositories.resources.findById(entity.resourceId)
    return resource?.schoolId
  })
}

interface ResourcePlacement {
  kind: 'class' | 'lesson' | 'activity' | 'assessment'
  id: string
  classGroupId: string
  startsAt?: Date
  endsAt?: Date
}

async function placement(assignment: ResourceAssignment, schoolId: string, repositories: SchoolRepositories): Promise<ResourcePlacement> {
  let target: ResourcePlacement
  if (assignment.classGroupId) {
    target = { kind: 'class', id: assignment.classGroupId, classGroupId: assignment.classGroupId }
  }
  else if (assignment.lessonSessionId) {
    const lesson = await repositories.lessonSessions.findById(assignment.lessonSessionId)
    if (!lesson)
      return denyResourceAccess()
    target = { kind: 'lesson', id: lesson.id, classGroupId: lesson.classGroupId, startsAt: lesson.startsAt, endsAt: lesson.endsAt }
  }
  else if (assignment.activitySessionId) {
    const activity = await repositories.activitySessions.findById(assignment.activitySessionId)
    if (!activity)
      return denyResourceAccess()
    target = { kind: 'activity', id: activity.id, classGroupId: activity.classGroupId, startsAt: activity.startsAt, endsAt: activity.endsAt }
  }
  else {
    const assessment = assignment.assessmentId ? await repositories.assessments.findById(assignment.assessmentId) : undefined
    if (!assessment)
      return denyResourceAccess()
    const lesson = assessment.lessonSessionId ? await repositories.lessonSessions.findById(assessment.lessonSessionId) : undefined
    if (assessment.lessonSessionId && (!lesson || lesson.classGroupId !== assessment.classGroupId))
      return denyResourceAccess()
    target = { kind: 'assessment', id: assessment.id, classGroupId: assessment.classGroupId, startsAt: assessment.isHomework ? undefined : assessment.startsAt ?? lesson?.startsAt, endsAt: assessment.isHomework ? undefined : assessment.endsAt ?? lesson?.endsAt }
  }
  const group = await repositories.classGroups.findById(target.classGroupId)
  if (!group || group.schoolId !== schoolId)
    return denyResourceAccess()
  return target
}

async function validateResourceAssignmentSave(
  assignment: ResourceAssignment,
  _existing: ResourceAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const resource = await repositories.resources.findById(assignment.resourceId)
  if (!resource)
    return denyResourceAccess()
  const proposed = await placement(assignment, resource.schoolId, repositories)
  const assignments = await repositories.resourceAssignments.list({ resourceId: assignment.resourceId })
  for (const existing of assignments) {
    if (existing.id === assignment.id)
      continue
    const other = await placement(existing, resource.schoolId, repositories)
    if ((proposed.kind === 'class' || other.kind === 'class') && proposed.classGroupId !== other.classGroupId)
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_TO_CLASS', `Resource ${resource.id} is reserved for another class`)
    if (proposed.kind === other.kind && proposed.id === other.id) {
      const code = { class: 'CLASS', lesson: 'LESSON_SESSION', activity: 'ACTIVITY_SESSION', assessment: 'ASSESSMENT' }[proposed.kind]
      throw new BusinessRuleViolationError(`RESOURCE_ALREADY_ASSIGNED_TO_${code}`, `Resource ${resource.id} is already assigned to ${proposed.id}`)
    }
    if (proposed.startsAt && proposed.endsAt && other.startsAt && other.endsAt
      && proposed.startsAt < other.endsAt && other.startsAt < proposed.endsAt) {
      throw new BusinessRuleViolationError('RESOURCE_ALREADY_ASSIGNED_OVERLAPPING', `Resource ${resource.id} is already assigned to overlapping occurrence ${other.id}`)
    }
  }
}
