import type { StudentDisciplinaryAction } from '../../../entities/students/student-disciplinary-action'
import type { EntityConfigFactory } from '../../../shared/common'
import { StudentDisciplinaryActionStatus } from '../../../entities/students/student-disciplinary-action'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, directSchoolTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, read, write } from '../../../shared/common'

export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(action(policy, 'behavior.read_incidents'), noopReadAccess),
    write: write(action(policy, 'behavior.manage_discipline'), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateStudentDisciplinaryActionSave,
    },
    atomicExecution,
  })

async function validateStudentDisciplinaryActionSave(
  entity: StudentDisciplinaryAction,
  existing: StudentDisciplinaryAction | undefined,
): Promise<void> {
  if (!existing || entity.status === existing.status)
    return
  if (existing.status !== StudentDisciplinaryActionStatus.Active) {
    throw new BusinessRuleViolationError('DISCIPLINARY_ACTION_STATUS_FINAL', `Disciplinary action ${existing.id} status cannot be changed from ${existing.status}`)
  }
}
