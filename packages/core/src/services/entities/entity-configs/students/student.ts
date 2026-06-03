import type { Student } from '../../../../entities/students/student'
import type { EntityConfigFactory } from '../../../shared/common'
import { StudentStatus } from '../../../../entities/students/student'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig, readByIds } from '../../../shared/common'

export const studentConfig: EntityConfigFactory<Student> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.students,
    'queries.read_student_directory',
    'students.manage_profile',
    readByIds((actor, ids) => input.policy.checkStudentAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateStudentSave,
    },
  }
}

export async function validateStudentSave(
  student: Student,
  existing: Student | undefined,
): Promise<void> {
  if (existing?.status === StudentStatus.Graduated && student.status !== StudentStatus.Graduated) {
    throw new BusinessRuleViolationError('GRADUATED_STUDENT_STATUS_RESTRICTED', `Student ${student.id} cannot leave graduated status through profile update`)
  }
}
