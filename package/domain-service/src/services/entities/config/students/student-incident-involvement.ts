import type { StudentIncidentInvolvement } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, StudentClassEnrollmentStatus } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-incident-involvement.ts (PR3)
export const studentIncidentInvolvementConfig: EntityConfigFactory<StudentIncidentInvolvement> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.studentIncidentInvolvements,
    tenant: incidentLinkedTenant(),
    resource: 'studentIncidentInvolvements',

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
