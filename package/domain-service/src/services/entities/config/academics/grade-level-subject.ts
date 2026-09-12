import { Permission } from '@edaya/core';
import type { GradeLevelSubject } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { indirectTenant } from '../../entity-config/tenant';

// Extracted from domain/academics/grade-level-subject.ts (PR3)
export const gradeLevelSubjectConfig: EntityConfigFactory<GradeLevelSubject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevelSubjects,
    tenant: gradeLevelSubjectTenant(),
    authorization: { resource: 'gradeLevelSubjects', read: [Permission.QUERY_CLASS_CURRICULUM_READ], write: [Permission.ACADEMIC_PROGRAM_UPDATE] },
    
    gates: {
      preSave: validateGradeLevelSubjectSave,
      preDelete: validateGradeLevelSubjectDelete,
    },
    atomicExecution,
  })

function gradeLevelSubjectTenant() {
  return indirectTenant(async (entity: GradeLevelSubject, repositories: SchoolRepositories) => {
    const gradeLevel = await repositories.gradeLevels.findById(entity.gradeLevelId)
    return gradeLevel?.schoolId
  })
}

export async function validateGradeLevelSubjectSave(
  gradeLevelSubject: GradeLevelSubject,
  existing: GradeLevelSubject | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [gradeLevel, academicYear, subject] = await Promise.all([
    repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId),
    repositories.academicYears.findById(gradeLevelSubject.academicYearId),
    repositories.subjects.findById(gradeLevelSubject.subjectId),
  ])
  if (!gradeLevel || !academicYear || !subject || academicYear.schoolId !== gradeLevel.schoolId || subject.schoolId !== gradeLevel.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.gradeLevelId !== gradeLevelSubject.gradeLevelId || existing.academicYearId !== gradeLevelSubject.academicYearId || existing.subjectId !== gradeLevelSubject.subjectId)) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_IDENTITY_IMMUTABLE',
      'gradeLevelId, academicYearId and subjectId cannot be changed on an existing grade level subject',
    )
  }
  const duplicate = await repositories.gradeLevelSubjects.findOne({
    gradeLevelId: gradeLevelSubject.gradeLevelId,
    academicYearId: gradeLevelSubject.academicYearId,
    subjectId: gradeLevelSubject.subjectId,
  })
  if (duplicate && duplicate.id !== gradeLevelSubject.id) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_ALREADY_EXISTS',
      `Subject ${gradeLevelSubject.subjectId} is already allocated to grade level ${gradeLevelSubject.gradeLevelId}`,
    )
  }
}

export async function validateGradeLevelSubjectDelete(
  gradeLevelSubject: GradeLevelSubject,
  repositories: SchoolRepositories,
): Promise<void> {
  const classSubjects = await repositories.classSubjects.list({ gradeLevelSubjectId: gradeLevelSubject.id })
  for (const classSubject of classSubjects) {
    const [assessments, lessonSessions, staffAssignments] = await Promise.all([
      repositories.assessments.list({ classSubjectId: classSubject.id }),
      repositories.lessonSessions.list({ classSubjectId: classSubject.id }),
      repositories.staffAssignments.list({ classSubjectId: classSubject.id }),
    ])
    if (assessments.length > 0 || lessonSessions.length > 0 || staffAssignments.length > 0) {
      throw new BusinessRuleViolationError(
        'GRADE_LEVEL_SUBJECT_HAS_DEPENDENCIES',
        `Cannot remove grade level subject ${gradeLevelSubject.id}: dependent class records still exist`,
      )
    }
  }
}
