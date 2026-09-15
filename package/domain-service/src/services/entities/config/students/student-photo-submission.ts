import type { StudentPhotoSubmission } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const studentPhotoSubmissionConfig: EntityConfigFactory<StudentPhotoSubmission> = ({ repositories, atomicExecution }) => {
  return {
    ...config({
      repository: repositories.studentPhotoSubmissions,
      tenant: directSchoolTenant(),
      resource: 'studentPhotoSubmissions',
      atomicExecution,
    }),
    gates: {
      preSave: validateStudentPhotoSubmissionSave,
    },
  }
}

export async function validateStudentPhotoSubmissionSave(
  submission: StudentPhotoSubmission,
  existing: StudentPhotoSubmission | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [student, guardian, attachment] = await Promise.all([
    repositories.students.findById(submission.studentId),
    repositories.guardians.findById(submission.submitterGuardianId),
    repositories.attachments.findById(submission.attachmentId),
  ])
  if (!student || student.schoolId !== submission.schoolId)
    denyResourceAccess()
  if (!guardian || guardian.schoolId !== submission.schoolId)
    denyResourceAccess()
  if (!attachment || attachment.schoolId !== submission.schoolId)
    denyResourceAccess()
  if (existing) {
    if (
      existing.schoolId !== submission.schoolId
      || existing.studentId !== submission.studentId
      || existing.submitterGuardianId !== submission.submitterGuardianId
      || existing.attachmentId !== submission.attachmentId
    ) {
      denyResourceAccess()
    }
  }
}
