import type { AuthorizationPolicy } from '@edaya/authorization'
import type { StudentIncidentInvolvement } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, DisciplineOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, StudentClassEnrollmentStatus } from '@edaya/core'
import { config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-incident-involvement.ts (PR3)
export const studentIncidentInvolvementConfig: EntityConfigFactory<StudentIncidentInvolvement> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentIncidentInvolvements,
    tenant: incidentLinkedTenant(),
    read: read(operationModule(DisciplineOperations.read), noopReadAccess),
    write: write(operationModule(DisciplineOperations.create), authorizeIncidentLinked(policy), authorizeIncidentLinkedDelete(policy)),
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
    if (incident.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [incident.lessonSessionId])
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
