import { Permission } from '@edaya/core';
import type { GuardianStudentLink } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { config } from '../../entity-config';

import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/students/guardian-student-link.ts (PR3)
export const guardianStudentLinkConfig: EntityConfigFactory<GuardianStudentLink> = ({ repositories, atomicExecution }) => {
  

  return config({
    repository: repositories.guardianLinks,
    tenant: directSchoolTenant(),
    authorization: { resource: 'guardianLinks', read: [Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ], write: [Permission.PARENT_UPDATE] },
    
    gates: {
      preSave: validateGuardianStudentLinkSave,
    },
    atomicExecution,
  })
}

export async function validateGuardianStudentLinkSave(
  link: GuardianStudentLink,
  existing: GuardianStudentLink | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [guardian, student] = await Promise.all([
    repositories.guardians.findById(link.guardianId),
    repositories.students.findById(link.studentId),
  ])
  if (!guardian || !student || guardian.schoolId !== link.schoolId || student.schoolId !== link.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.guardianId !== link.guardianId || existing.studentId !== link.studentId)) {
    denyResourceAccess()
  }
}
