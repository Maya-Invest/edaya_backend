import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError, defaultSubjectCategoryId, SubjectCategoryEntity } from '@edaya/core'

/** Called explicitly by dataset application, inside its command transaction. */
export async function ensureDatasetSubjectCategories(repositories: SchoolRepositories, schoolId: string, categories: readonly { code: string, name: string }[]): Promise<Map<string, string>> {
  const existing = await repositories.subjectCategories.list({ schoolId })
  const result = new Map<string, string>()
  for (const category of categories) {
    const id = defaultSubjectCategoryId(schoolId, category.name)
    const found = existing.find(row => row.id === id) ?? existing.find(row => row.name === category.name)
    if (found) {
      result.set(category.code, found.id)
    }
    else {
      const collision = await repositories.subjectCategories.findById(id)
      if (collision)
        throw new BusinessRuleViolationError('SUBJECT_CATEGORY_CONFLICT', 'Dataset category ID belongs to another school')
      const row = new SubjectCategoryEntity({ id, schoolId, name: category.name })
      await repositories.subjectCategories.save(row)
      existing.push(row)
      result.set(category.code, id)
    }
  }
  return result
}

export async function requireSubjectCategory(repositories: SchoolRepositories, schoolId: string, categoryId: string): Promise<void> {
  const category = await repositories.subjectCategories.findById(categoryId)
  if (!category || category.schoolId !== schoolId)
    throw new BusinessRuleViolationError('SUBJECT_CATEGORY_NOT_FOUND', `Subject category ${categoryId} is not in this school`)
}
