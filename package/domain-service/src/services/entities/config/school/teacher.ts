import type { Teacher } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { assertUniquePersonCode } from '../person-code-uniqueness'

// Extracted from domain/school/teacher.ts (PR3)
export const teacherConfig: EntityConfigFactory<Teacher> = (input) => {
  return {
    ...config({
      repository: input.repositories.teachers,
      tenant: directSchoolTenant(),
      resource: 'teachers',

      atomicExecution: input.atomicExecution,
    }),
    gates: {
      preSave: validateTeacherSave,
      preDelete: validateTeacherDelete,
    },
  }
}

async function validateTeacherSave(
  teacher: Teacher,
  _existing: Teacher | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertUniquePersonCode({
    code: teacher.code,
    schoolId: teacher.schoolId,
    entityId: teacher.id,
    errorCode: 'TEACHER_CODE_ALREADY_EXISTS',
    entityLabel: 'Teacher',
    listBySchool: () => repositories.teachers.list({ schoolId: teacher.schoolId }),
  })
}

async function validateTeacherDelete(
  teacher: Teacher,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.teacherAssignments.list({ teacherId: teacher.id })
  const unavailabilities = await repositories.teacherUnavailabilities.list({ teacherId: teacher.id })
  if (assignments.length > 0 || unavailabilities.length > 0) {
    throw new BusinessRuleViolationError('TEACHER_HAS_DEPENDENCIES', `Cannot delete teacher ${teacher.id}: dependent records still exist`)
  }
}
