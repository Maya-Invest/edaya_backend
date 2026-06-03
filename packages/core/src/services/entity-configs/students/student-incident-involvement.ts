import type { AuthorizationPolicy } from '../../../authorization'
import type { StudentIncidentInvolvement } from '../../../entities/students/student-incident-involvement'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { action, config, indirectTenant, noopReadAccess, read, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const studentIncidentInvolvementConfig: EntityConfigFactory<StudentIncidentInvolvement> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentIncidentInvolvements,
    tenant: incidentLinkedTenant(),
    read: read(action(policy, 'behavior.read_incidents'), noopReadAccess),
    write: write(action(policy, 'behavior.report_incident'), authorizeIncidentLinked(policy), authorizeIncidentLinkedDelete(policy)),
    gates: {
      preSave: validateStudentIncidentInvolvementSave,
    },
    atomicExecution,
  })

function incidentLinkedTenant(): EntityTenantResolver<StudentIncidentInvolvement> {
  return indirectTenant(async (entity, repositories) => {
    const incident = await repositories.incidents.findById(entity.incidentId)
    return incident?.schoolId
  })
}

function authorizeIncidentLinked(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentIncidentInvolvement>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    const incident = await repositories.incidents.findById(entity.incidentId)
    if (!incident) {
      denyResourceAccess()
    }
    if (incident.classGroupId)
      await policy.checkClassGroupAccess(actor, [incident.classGroupId])
    if (incident.sessionId)
      await policy.checkSessionAccess(actor, [incident.sessionId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeIncidentLinkedDelete(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<StudentIncidentInvolvement>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await authorizeIncidentLinked(policy)(actor, entity, entity, repositories)
  }
}

async function validateStudentIncidentInvolvementSave(
  involvement: StudentIncidentInvolvement,
  existing: StudentIncidentInvolvement | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [incident, student] = await Promise.all([
    repositories.incidents.findById(involvement.incidentId),
    repositories.students.findById(involvement.studentId),
  ])
  if (!incident || !student || student.schoolId !== incident.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.incidentId !== involvement.incidentId || existing.studentId !== involvement.studentId)) {
    denyResourceAccess()
  }
  if (incident.classGroupId) {
    const enrollments = await repositories.enrollments.list({
      studentId: involvement.studentId,
      classGroupId: incident.classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (enrollments.length === 0) {
      throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${involvement.studentId} does not have an active enrollment in classGroup ${incident.classGroupId}`)
    }
  }
  const duplicates = await repositories.studentIncidentInvolvements.list({
    incidentId: involvement.incidentId,
    studentId: involvement.studentId,
  })
  const duplicate = duplicates[0]
  if (duplicate && duplicate.id !== involvement.id) {
    throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${involvement.studentId} is already linked to incident ${involvement.incidentId}`)
  }
}
