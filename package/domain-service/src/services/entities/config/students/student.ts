import { Permission } from '@edaya/core';
import type { Student } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';

import { AttachmentOwnerKind, BusinessRuleViolationError, StudentStatus } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/students/student.ts (PR3)
export const studentConfig: EntityConfigFactory<Student> = ({ repositories, atomicExecution }) => {
  

  return config({
    repository: repositories.students,
    tenant: directSchoolTenant(),
    authorization: { resource: 'students', read: [Permission.QUERY_STUDENT_DIRECTORY_READ, Permission.QUERY_STUDENT_DETAIL_READ], write: [Permission.STUDENT_UPDATE] },
    
    gates: {
      preSave: validateStudentSave,
      preDelete: validateStudentDelete,
    },
    atomicExecution,
  })
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
