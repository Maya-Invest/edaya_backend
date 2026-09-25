import { BusinessRuleViolationError, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

describe('subject category catalog', () => {
  test('configureSubjectCategory renames a category and blocks delete while a subject uses it', async () => {
    const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
    const service = fixture.app
    const repositories = fixture.schoolRepositories

    const category = await service.academicsWorkflow.configureSubjectCategory({
      id: 'cat-custom',
      schoolId: 'sch1',
      name: 'Informatique',
    })
    expect(category.name).toBe('Informatique')

    const renamed = await service.academicsWorkflow.configureSubjectCategory({
      id: category.id,
      schoolId: 'sch1',
      name: 'Numérique',
    })
    expect(renamed.name).toBe('Numérique')
    expect((await repositories.subjectCategories.findById(category.id))?.name).toBe('Numérique')

    const subject = new Subject({
      id: 'subj-info',
      schoolId: 'sch1',
      name: 'Informatique',
      categoryId: category.id,
    })
    await service.baseService.entities.subjects.save(subject)

    await expect(service.baseService.entities.subjectCategories.delete(category.id))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)

    await service.baseService.entities.subjects.delete(subject.id)
    await service.baseService.entities.subjectCategories.delete(category.id)
    expect(await repositories.subjectCategories.findById(category.id)).toBeUndefined()
  })
})
