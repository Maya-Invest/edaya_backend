import type { AuthorizationPolicy } from '../../../authorization'
import type { StudentIncidentInvolvement } from '../../../entities/students/student-incident-involvement'
import type { EntityConfigFactory } from '../../../shared/common'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { action, config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared/common'

export const studentIncidentInvolvementConfig: EntityConfigFactory<StudentIncidentInvolvement> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentIncidentInvolvements,
    tenant: incidentLinkedTenant(),
    read: read(action(policy, 'behavior.read_incidents'), noopReadAccess),
    write: write(action(policy, 'behavior.report_incident'), authorizeIncidentLinked(policy), authorizeIncidentLinkedDelete(policy)),
    atomicExecution,
  })

function incidentLinkedTenant(): EntityTenantResolver<StudentIncidentInvolvement> {
  return indirectTenant(async (entity, repositories) => {
    const incident = await repositories.incidents.findById(entity.incidentId)
    return incident?.schoolId
  })
}

function authorizeIncidentLinked(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentIncidentInvolvement>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeIncidentLinkedDelete(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentIncidentInvolvement>['authorizeDelete'] {
  return noopDeleteAccess
}
