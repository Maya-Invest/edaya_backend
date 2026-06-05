import type { GuardianStudentLink } from '../../../entities/students/guardian-student-link'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { directPermissionEntityConfig, unique } from '../../../shared'

export const guardianStudentLinkConfig: EntityConfigFactory<GuardianStudentLink> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.guardianLinks,
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.PARENT_UPDATE,
    async (actor, entities) => {
      await input.policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    },
  )
  return {
    ...config,
    gates: {
      preSave: validateGuardianStudentLinkSave,
    },
  }
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
