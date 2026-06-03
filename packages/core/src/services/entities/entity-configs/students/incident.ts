import type { Incident } from '../../../../entities/students/incident'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import { IncidentStatus } from '../../../../entities/students/incident'
import { AuthorizationError, AuthorizationErrorCode } from '../../../authorization'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, dateTime, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared/common'

export const incidentConfig: EntityConfigFactory<Incident> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.incidents,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'behavior.read_incidents'), noopReadAccess),
    write: write(action(policy, 'behavior.report_incident'), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateIncidentSave,
    },
    atomicExecution,
  })

export async function validateIncidentSave(
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
  if (entity.sessionId) {
    const session = await repositories.sessions.findById(entity.sessionId)
    const classGroup = session ? await repositories.classGroups.findById(session.classGroupId) : undefined
    if (
      !session
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
