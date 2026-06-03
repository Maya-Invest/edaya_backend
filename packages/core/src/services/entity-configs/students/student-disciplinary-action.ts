import type { AuthorizationPolicy } from '../../../authorization'
import type { StudentDisciplinaryAction } from '../../../entities/students/student-disciplinary-action'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { StudentDisciplinaryActionStatus } from '../../../entities/students/student-disciplinary-action'
import { action, config, directSchoolTenant, noopReadAccess, read, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'behavior.read_incidents'), noopReadAccess),
    write: write(action(policy, 'behavior.manage_discipline'), authorizeStudentDisciplinaryAction(policy), authorizeStudentDisciplinaryActionDelete(policy)),
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
