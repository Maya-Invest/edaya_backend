import type { TeacherAssignment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'

import { BusinessRuleViolationError, TeacherAssignmentKind } from '@edaya/core'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/school/teacher-assignment.ts (PR3)
export const teacherAssignmentConfig: EntityConfigFactory<TeacherAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.teacherAssignments,
    tenant: teacherAssignmentTenant(),
    resource: 'teacherAssignments',

    gates: {
      preSave: validateTeacherAssignmentSave,
    },
    atomicExecution,
  })

function teacherAssignmentTenant(): EntityTenantResolver<TeacherAssignment> {
  return indirectTenant(async (entity, repositories) => {
    const teacher = await repositories.teachers.findById(entity.teacherId)
    return teacher?.schoolId
  })
}

export async function validateTeacherAssignmentSave(
  assignment: TeacherAssignment,
  existing: TeacherAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const teacher = await repositories.teachers.findById(assignment.teacherId)
  if (!teacher) {
    throw new BusinessRuleViolationError('TEACHER_NOT_FOUND', `Teacher ${assignment.teacherId} not found`)
  }

  const academicYear = await repositories.academicYears.findById(assignment.academicYearId)
  if (!academicYear || academicYear.schoolId !== teacher.schoolId) {
    throw new BusinessRuleViolationError('ACADEMIC_YEAR_NOT_FOUND', `Academic year ${assignment.academicYearId} not found in school`)
  }

  if (assignment.kind === TeacherAssignmentKind.Subject) {
    const classSubject = await repositories.classSubjects.findById(assignment.classSubjectId!)
    if (!classSubject) {
      throw new BusinessRuleViolationError('CLASS_SUBJECT_NOT_FOUND', `Class subject ${assignment.classSubjectId} not found`)
    }
    const classGroup = await repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup || classGroup.schoolId !== teacher.schoolId || classGroup.academicYearId !== assignment.academicYearId) {
      throw new BusinessRuleViolationError('CLASS_GROUP_NOT_FOUND', 'Class subject must belong to the assignment academic year')
    }
    return
  }

  const classGroup = await repositories.classGroups.findById(assignment.classGroupId!)
  if (!classGroup || classGroup.schoolId !== teacher.schoolId || classGroup.academicYearId !== assignment.academicYearId) {
    throw new BusinessRuleViolationError('CLASS_GROUP_NOT_FOUND', `Class group ${assignment.classGroupId} not found in school/year`)
  }

  if (existing && existing.id !== assignment.id) {
    throw new BusinessRuleViolationError('TEACHER_ASSIGNMENT_CONFLICT', 'Assignment id mismatch')
  }
}
