import { Permission } from '@edaya/core';

import type { StudentDisciplinaryAction } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError, StudentDisciplinaryActionStatus } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/students/student-disciplinary-action.ts (PR3)
export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    authorization: { resource: 'studentDisciplinaryActions', read: [Permission.DISCIPLINE_READ], write: [Permission.DISCIPLINE_VALIDATE] },
    
    gates: {
      preSave: validateStudentDisciplinaryActionSave,
      preDelete: validateStudentDisciplinaryActionDelete,
    },
    atomicExecution,
  })

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
