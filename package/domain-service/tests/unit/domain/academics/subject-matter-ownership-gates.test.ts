import { SubjectMatter, withShortName } from '@edaya/core'
import { expect, test } from 'bun:test'
import { validateSubjectMatterSave } from '../../../../src/services/entities/config/academics/subject-matter'

const chapter = new SubjectMatter(withShortName({ id: 'chapter', subjectId: 'subject', name: 'Algebra', sequenceOrder: 1 }))
const repositories = { subjects: { findById: async () => ({ id: 'subject' }) } } as never
test('chapters belong directly to their subject and cannot be moved', async () => {
  await validateSubjectMatterSave(chapter, undefined, repositories)
  await expect(validateSubjectMatterSave(new SubjectMatter(withShortName({ ...chapter.data, subjectId: 'other' })), chapter, repositories)).rejects.toMatchObject({ code: 'SUBJECT_MATTER_IDENTITY_IMMUTABLE' })
})
