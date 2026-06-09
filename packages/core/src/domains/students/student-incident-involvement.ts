import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { StudentClassEnrollmentStatus } from '../../domains'
import { config, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum IncidentInvolvementRole {
  Subject = 'subject',
  Witness = 'witness',
  Victim = 'victim',
}

export interface StudentIncidentInvolvementArgs {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string | null
  createdAt?: Date
}

/**
 * Links a Student to an Incident, specifying their role and any resulting disciplinary action.
 * References a DisciplinaryAction from the school catalog and allows freeform notes.
 */
export class StudentIncidentInvolvement {
  readonly id: string
  readonly incidentId: string
  readonly studentId: string
  readonly role: IncidentInvolvementRole
  readonly notes?: string
  readonly createdAt: Date

  constructor({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: StudentIncidentInvolvementArgs) {
    this.id = requireNonBlank(id, 'id')
    this.incidentId = requireNonBlank(incidentId, 'incidentId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.role = role
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdAt = createdAt ?? new Date()
  }
}

export const studentIncidentInvolvementConfig: EntityConfigFactory<StudentIncidentInvolvement> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentIncidentInvolvements,
    tenant: incidentLinkedTenant(),
    read: read(permissionAction(policy, Permission.DISCIPLINE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.DISCIPLINE_CREATE), authorizeIncidentLinked(policy), authorizeIncidentLinkedDelete(policy)),
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
