import type { Incident } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError, IncidentStatus } from '@edaya/core'
import { config } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/incident.ts (PR3)
export const incidentConfig: EntityConfigFactory<Incident> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.incidents,
    tenant: directSchoolTenant(),
    resource: 'incidents',

    gates: {
      preSave: validateIncidentSave,
      preDelete: validateIncidentDelete,
    },
    atomicExecution,
  })

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
      denyResourceAccess()
    }
    return
  }
  if (entity.classGroupId) {
    const classGroup = await repositories.classGroups.findById(entity.classGroupId)
    if (!classGroup || classGroup.schoolId !== entity.schoolId) {
      denyResourceAccess()
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
