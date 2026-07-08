import type { Teacher } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { AccessControlOperations, TeacherOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, operationModule, read, readByIds, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/teacher.ts (PR3)
export const teacherConfig: EntityConfigFactory<Teacher> = (input) => {
  const readAccess = readByIds((actor, ids) => input.policy.checkTeacherAccess(actor, ids))

  return {
    ...config({
      repository: input.repositories.teachers,
      tenant: directSchoolTenant(),
      read: read(operationModule(TeacherOperations.selfRead), readAccess),
      write: write(
        operationModule(AccessControlOperations.assign),
        authorizeExistingById(readAccess),
        authorizeDeleteByReadAccess(readAccess),
      ),
      atomicExecution: input.atomicExecution,
    }),
    gates: {
      preDelete: validateTeacherDelete,
    },
  }
}

async function validateTeacherDelete(
  teacher: Teacher,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.teacherAssignments.list({ teacherId: teacher.id })
  if (assignments.length > 0) {
    throw new BusinessRuleViolationError('TEACHER_HAS_DEPENDENCIES', `Cannot delete teacher ${teacher.id}: dependent records still exist`)
  }
}
