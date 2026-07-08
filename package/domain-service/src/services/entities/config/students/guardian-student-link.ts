import type { GuardianStudentLink } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess, GuardianOperations } from '@edaya/authorization'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, operationModule, read, write } from '../../entity-config'
import { unique } from '../../entity-config/helper-utils'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/guardian-student-link.ts (PR3)
export const guardianStudentLinkConfig: EntityConfigFactory<GuardianStudentLink> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = async (actor: Parameters<typeof policy.checkStudentAccess>[0], entities: readonly GuardianStudentLink[]) => {
    await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
  }

  return config({
    repository: repositories.guardianLinks,
    tenant: directSchoolTenant(),
    read: read(operationModule(GuardianOperations.read), readAccess),
    write: write(
      operationModule(GuardianOperations.update),
      authorizeExistingById(readAccess),
      authorizeDeleteByReadAccess(readAccess),
    ),
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
