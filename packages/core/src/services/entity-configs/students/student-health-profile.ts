import type { StudentHealthProfile } from '../../../entities/students/student-health-profile'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization'
import { directEntityConfig, readByIds } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const studentHealthProfileConfig: EntityConfigFactory<StudentHealthProfile> = (input) => {
  const config = directEntityConfig(
    input,
    input.repositories.studentHealthProfiles,
    'queries.read_student_detail',
    'students.manage_health',
    readByIds((actor, ids) => input.policy.checkStudentHealthAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preSave: validateStudentHealthProfileSave,
    },
  }
}

async function validateStudentHealthProfileSave(
  profile: StudentHealthProfile,
  existing: StudentHealthProfile | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const student = await repositories.students.findById(profile.studentId)
  if (!student || student.schoolId !== profile.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.schoolId !== profile.schoolId || existing.studentId !== profile.studentId)) {
    denyResourceAccess()
  }
  const profiles = await repositories.studentHealthProfiles.list({
    schoolId: profile.schoolId,
    studentId: profile.studentId,
  })
  const duplicate = profiles.find(item => item.id !== profile.id)
  if (duplicate) {
    throw new BusinessRuleViolationError('STUDENT_HEALTH_PROFILE_ALREADY_EXISTS', `Student ${profile.studentId} already has a health profile`)
  }
}
