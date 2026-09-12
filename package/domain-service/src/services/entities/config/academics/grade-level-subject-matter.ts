import { Permission } from '@edaya/core';
import type { GradeLevelSubjectMatter } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { indirectTenant } from '../../entity-config/tenant';

// Extracted from domain/academics/grade-level-subject-matter.ts (PR3)
export const gradeLevelSubjectMatterConfig: EntityConfigFactory<GradeLevelSubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevelSubjectMatters,
    tenant: gradeLevelSubjectMatterTenant(),
    authorization: { resource: 'gradeLevelSubjectMatters', read: [Permission.QUERY_CLASS_CURRICULUM_READ], write: [Permission.ACADEMIC_PROGRAM_UPDATE] },
    
    gates: {
      preSave: validateGradeLevelSubjectMatterSave,
    },
    atomicExecution,
  })

function gradeLevelSubjectMatterTenant() {
  return indirectTenant(async (entity: GradeLevelSubjectMatter, repositories: SchoolRepositories) => {
    const gradeLevelSubject = await repositories.gradeLevelSubjects.findById(entity.gradeLevelSubjectId)
    if (!gradeLevelSubject) {
      return undefined
    }
    const gradeLevel = await repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId)
    return gradeLevel?.schoolId
  })
}

export async function validateGradeLevelSubjectMatterSave(
  gradeLevelSubjectMatter: GradeLevelSubjectMatter,
  _existing: GradeLevelSubjectMatter | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [gradeLevelSubject, subjectMatter] = await Promise.all([
    repositories.gradeLevelSubjects.findById(gradeLevelSubjectMatter.gradeLevelSubjectId),
    repositories.subjectMatters.findById(gradeLevelSubjectMatter.subjectMatterId),
  ])
  if (!gradeLevelSubject || !subjectMatter || subjectMatter.subjectId !== gradeLevelSubject.subjectId) {
    denyResourceAccess()
  }
  const duplicate = await repositories.gradeLevelSubjectMatters.findOne({
    gradeLevelSubjectId: gradeLevelSubjectMatter.gradeLevelSubjectId,
    subjectMatterId: gradeLevelSubjectMatter.subjectMatterId,
  })
  if (duplicate && duplicate.id !== gradeLevelSubjectMatter.id) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_MATTER_ALREADY_EXISTS',
      `Matter ${gradeLevelSubjectMatter.subjectMatterId} is already linked to grade level subject ${gradeLevelSubjectMatter.gradeLevelSubjectId}`,
    )
  }
}
