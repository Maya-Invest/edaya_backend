import { AuthorizationError } from '@edaya/authorization'
import { Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { validateSubjectDelete, validateSubjectSave } from '../../../../src/services/entities/config/academics/subject'

const subject = new Subject({ id: 'subject', schoolId: 'school', gradeLevelId: 'grade', academicYearId: 'year', name: 'Math', categoryId: 'category' })
function repositories(overrides: Record<string, unknown> = {}) {
  return {
    gradeLevels: { findById: async () => ({ schoolId: 'school' }) },
    academicYears: { findById: async () => ({ schoolId: 'school' }) },
    subjectCategories: { findById: async () => ({ schoolId: 'school' }) },
    classSubjects: { count: async () => 0 },
    subjectMatters: { count: async () => 0 },
    sections: { count: async () => 0 },
    ...overrides,
  } as never
}
describe('subject ownership', () => {
  test('accepts valid school, grade and year', async () => {
    await validateSubjectSave(subject, undefined, repositories())
  })
  test('rejects a foreign year', async () => {
    await expect(validateSubjectSave(subject, undefined, repositories({ academicYears: { findById: async () => ({ schoolId: 'foreign' }) } }))).rejects.toBeInstanceOf(AuthorizationError)
  })
  test('rejects changing placement', async () => {
    await expect(validateSubjectSave(new Subject({ ...subject.data, gradeLevelId: 'other' }), subject, repositories())).rejects.toMatchObject({ code: 'SUBJECT_IDENTITY_IMMUTABLE' })
  })
  test('requires mirrors to be removed before the parent', async () => {
    await validateSubjectDelete(subject, repositories())
    await expect(validateSubjectDelete(subject, repositories({ classSubjects: { count: async () => 1 } }))).rejects.toMatchObject({ code: 'SUBJECT_HAS_DEPENDENCIES' })
  })
})
