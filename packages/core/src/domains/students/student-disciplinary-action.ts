import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, directSchoolTenant, noopReadAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum StudentDisciplinaryActionStatus {
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface StudentDisciplinaryActionArgs {
  id: string
  schoolId: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  assignedByStaffId: string
  startsAt?: Date | null
  endsAt?: Date | null
  status?: StudentDisciplinaryActionStatus
  notes?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Represents a disciplinary catalog action actually applied to a student.
 */
export class StudentDisciplinaryAction {
  readonly id: string
  readonly schoolId: string
  readonly incidentId: string
  readonly studentId: string
  readonly disciplinaryActionId: string
  readonly assignedByStaffId: string
  readonly startsAt?: Date
  readonly endsAt?: Date
  readonly status: StudentDisciplinaryActionStatus
  readonly notes?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    incidentId,
    studentId,
    disciplinaryActionId,
    assignedByStaffId,
    startsAt,
    endsAt,
    status = StudentDisciplinaryActionStatus.Active,
    notes,
    createdAt,
    updatedAt,
  }: StudentDisciplinaryActionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.incidentId = requireNonBlank(incidentId, 'incidentId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.disciplinaryActionId = requireNonBlank(disciplinaryActionId, 'disciplinaryActionId')
    this.assignedByStaffId = requireNonBlank(assignedByStaffId, 'assignedByStaffId')
    this.startsAt = startsAt ? requireValidDate(startsAt, 'startsAt') : undefined
    this.endsAt = endsAt ? requireValidDate(endsAt, 'endsAt') : undefined
    this.status = status
    this.notes = requireOptionalNonBlank(notes, 'notes')

    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now

    if (this.endsAt && this.startsAt && this.endsAt.getTime() < this.startsAt.getTime()) {
      throw new Error('endsAt must not be before startsAt')
    }
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}

export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.DISCIPLINE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.DISCIPLINE_VALIDATE), authorizeStudentDisciplinaryAction(policy), authorizeStudentDisciplinaryActionDelete(policy)),
    gates: {
      preSave: validateStudentDisciplinaryActionSave,
      preDelete: validateStudentDisciplinaryActionDelete,
    },
    atomicExecution,
  })

function authorizeStudentDisciplinaryAction(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentDisciplinaryAction>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    if (existing && entity.status !== existing.status && existing.status !== StudentDisciplinaryActionStatus.Active) {
      return
    }
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

function authorizeStudentDisciplinaryActionDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentDisciplinaryAction>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await authorizeStudentDisciplinaryAction(policy)(actor, entity, entity, repositories)
  }
}

async function validateStudentDisciplinaryActionSave(
  entity: StudentDisciplinaryAction,
  existing: StudentDisciplinaryAction | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && entity.status !== existing.status && existing.status !== StudentDisciplinaryActionStatus.Active) {
    throw new BusinessRuleViolationError('DISCIPLINARY_ACTION_STATUS_FINAL', `Disciplinary action ${existing.id} status cannot be changed from ${existing.status}`)
  }
  const [incident, student, catalogAction, involvement] = await Promise.all([
    repositories.incidents.findById(entity.incidentId),
    repositories.students.findById(entity.studentId),
    repositories.disciplinaryActions.findById(entity.disciplinaryActionId),
    repositories.studentIncidentInvolvements.list({
      incidentId: entity.incidentId,
      studentId: entity.studentId,
    }),
  ])
  if (
    !incident
    || !student
    || !catalogAction
    || involvement.length === 0
    || incident.schoolId !== entity.schoolId
    || student.schoolId !== entity.schoolId
    || catalogAction.schoolId !== entity.schoolId
  ) {
    denyResourceAccess()
  }
  if (existing && (
    existing.schoolId !== entity.schoolId
    || existing.incidentId !== entity.incidentId
    || existing.studentId !== entity.studentId
    || existing.disciplinaryActionId !== entity.disciplinaryActionId
  )) {
    denyResourceAccess()
  }
}

async function validateStudentDisciplinaryActionDelete(
  entity: StudentDisciplinaryAction,
): Promise<void> {
  if (entity.status !== StudentDisciplinaryActionStatus.Active) {
    throw new BusinessRuleViolationError('DISCIPLINARY_ACTION_STATUS_FINAL', `Disciplinary action ${entity.id} status cannot be deleted from ${entity.status}`)
  }
}
