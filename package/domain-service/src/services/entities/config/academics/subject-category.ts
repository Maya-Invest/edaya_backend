import type { SubjectCategoryEntity } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { BusinessRuleViolationError } from '@edaya/core'
import { requireSchool } from '../../../require-school'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const subjectCategoryConfig: EntityConfigFactory<SubjectCategoryEntity> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjectCategories,
    tenant: directSchoolTenant(),
    resource: 'subjectCategories',
    gates: {
      preSave: validateSubjectCategorySave,
      preDelete: validateSubjectCategoryDelete,
    },
    atomicExecution,
  })

async function validateSubjectCategorySave(
  category: SubjectCategoryEntity,
  _existing: SubjectCategoryEntity | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSchool(repositories.schools, category.schoolId)
  const duplicate = await repositories.subjectCategories.findOne({
    schoolId: category.schoolId,
    name: category.name,
  })
  if (duplicate && duplicate.id !== category.id) {
    throw new BusinessRuleViolationError(
      'SUBJECT_CATEGORY_NAME_TAKEN',
      `School ${category.schoolId} already has a subject category named ${category.name}`,
    )
  }
}

async function validateSubjectCategoryDelete(
  category: SubjectCategoryEntity,
  repositories: SchoolRepositories,
): Promise<void> {
  const subject = await repositories.subjects.findOne({ categoryId: category.id })
  if (subject) {
    throw new BusinessRuleViolationError(
      'SUBJECT_CATEGORY_IN_USE',
      `Subject category ${category.name} is still used by a subject`,
    )
  }
}
