import type { AuthorizationPolicy } from '@edaya/authorization'
import type { StudentDisciplinaryAction } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, DisciplineOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, StudentDisciplinaryActionStatus } from '@edaya/core'
import { config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-disciplinary-action.ts (PR3)
export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(operationModule(DisciplineOperations.read), noopReadAccess),
    write: write(operationModule(DisciplineOperations.validate), authorizeStudentDisciplinaryAction(policy), authorizeStudentDisciplinaryActionDelete(policy)),
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
    if (incident.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [incident.lessonSessionId])
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
