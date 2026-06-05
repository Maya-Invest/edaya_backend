import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { StudentStatus } from '../../../entities/students/student'
import { directPermissionEntityConfig, readByIds } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const studentConfig: EntityConfigFactory<Student> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.students,
    Permission.QUERY_STUDENT_DIRECTORY_READ,
    Permission.STUDENT_UPDATE,
    readByIds((actor, ids) => input.policy.checkStudentAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateStudentSave,
      preDelete: validateStudentDelete,
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

async function validateStudentDelete(
  student: Student,
  repositories: SchoolRepositories,
): Promise<void> {
  const [
    enrollments,
    guardianLinks,
    notes,
    healthProfiles,
    studentFees,
    attendance,
    assessmentResults,
    reportCards,
    incidentInvolvements,
    disciplinaryActions,
    attachments,
  ] = await Promise.all([
    repositories.enrollments.list({ studentId: student.id }),
    repositories.guardianLinks.list({ studentId: student.id }),
    repositories.studentNotes.list({ studentId: student.id }),
    repositories.studentHealthProfiles.list({ studentId: student.id }),
    repositories.studentFees.list({ studentId: student.id }),
    repositories.attendance.list({ studentId: student.id }),
    repositories.assessmentResults.list({ studentId: student.id }),
    repositories.results.list({ studentId: student.id }),
    repositories.studentIncidentInvolvements.list({ studentId: student.id }),
    repositories.studentDisciplinaryActions.list({ studentId: student.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Student, ownerId: student.id }),
  ])
  if (
    enrollments.length > 0
    || guardianLinks.length > 0
    || notes.length > 0
    || healthProfiles.length > 0
    || studentFees.length > 0
    || attendance.length > 0
    || assessmentResults.length > 0
    || reportCards.length > 0
    || incidentInvolvements.length > 0
    || disciplinaryActions.length > 0
    || attachments.length > 0
  ) {
    throw new BusinessRuleViolationError('STUDENT_HAS_DEPENDENCIES', `Cannot delete student ${student.id}: dependent records still exist`)
  }
}
