import type { SchoolRepositories } from '../../ports/school-repositories'
import {
  BusinessRuleViolationError,
  defaultSubjectCategoryId,
  SubjectCategory,
  SubjectCategoryEntity,
} from '@edaya/core'

export async function ensureDefaultSubjectCategories(
  repositories: SchoolRepositories,
  schoolId: string,
): Promise<void> {
  const existing = await repositories.subjectCategories.list({ schoolId })
  const names = new Set(existing.map(category => category.name))
  for (const name of Object.values(SubjectCategory)) {
    if (names.has(name)) {
      continue
    }
    await repositories.subjectCategories.save(new SubjectCategoryEntity({
      id: defaultSubjectCategoryId(schoolId, name),
      schoolId,
      name,
    }))
  }
}

export async function requireSubjectCategory(
  repositories: SchoolRepositories,
  schoolId: string,
  categoryId: string,
): Promise<void> {
  let category = await repositories.subjectCategories.findById(categoryId)
  if (!category) {
    await ensureDefaultSubjectCategories(repositories, schoolId)
    category = await repositories.subjectCategories.findById(categoryId)
  }
  if (!category || category.schoolId !== schoolId) {
    throw new BusinessRuleViolationError(
      'SUBJECT_CATEGORY_NOT_FOUND',
      `Subject category ${categoryId} is not in this school`,
    )
  }
}
