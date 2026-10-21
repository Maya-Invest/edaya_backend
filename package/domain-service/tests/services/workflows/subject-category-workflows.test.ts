import { AcademicDiscipline, AcademicYear, BusinessRuleViolationError, GradeLevel } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

describe('subject category catalog', () => {
  test('configureSubjectCategory renames a category and blocks delete while a subject uses it', async () => {
    const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
    const service = fixture.app
    const repositories = fixture.schoolRepositories
    await repositories.academicDisciplines.save(new AcademicDiscipline({ id: 'test-discipline', schoolId: 'sch1', code: 'TEST', name: 'Test discipline' }))

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

    await repositories.gradeLevels.save(new GradeLevel({ id: 'grade1', schoolId: 'sch1', name: '6ème', label: '6ème', order: 1 }))
    await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
    const subject = await service.academicsWorkflow.configureSubject({ disciplineId: 'test-discipline', gradeLevelId: 'grade1', academicYearId: 'ay1', id: 'subj-info', schoolId: 'sch1', name: 'Informatique', categoryId: category.id })

    await expect(service.baseService.entities.subjectCategories.delete(category.id))
      .rejects
      .toBeInstanceOf(BusinessRuleViolationError)

    await service.academicsWorkflow.removeSubject({ subjectId: subject.id })
    await service.baseService.entities.subjectCategories.delete(category.id)
    expect(await repositories.subjectCategories.findById(category.id)).toBeUndefined()
  })
})
