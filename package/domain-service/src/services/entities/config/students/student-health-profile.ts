import { Permission } from '@edaya/core';
import type { StudentHealthProfile } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/students/student-health-profile.ts (PR3)
export const studentHealthProfileConfig: EntityConfigFactory<StudentHealthProfile> = ({ repositories, atomicExecution }) => {
  

  return {
    ...config({
      repository: repositories.studentHealthProfiles,
      tenant: directSchoolTenant(),
      authorization: { resource: 'studentHealthProfiles', read: [Permission.STUDENT_HEALTH_READ], write: [Permission.STUDENT_HEALTH_UPDATE] },
      
      atomicExecution,
    }),
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
