import { AcademicDiscipline, AcademicYear, defaultSubjectCategoryId, SubjectCategoryEntity } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { ensureDatasetSubjectCategories, requireSubjectCategory } from '../../../src/capabilities/academics/dataset-subject-categories'
import { applyStructureTemplate } from '../../../src/capabilities/onboarding/apply-structure-template'
import { createTestApp } from '../../support/create-test-app'
import { createOnboardingTestDataset } from '../../support/onboarding-dataset'
import { createPlatformRegisterTestActor } from '../../support/test-actor'

const catalog = [{ code: 'SCI', name: 'Scientifique' }, { code: 'ART', name: 'Arts' }]
describe('dataset-owned categories', () => {
  test('school registration starts empty and validation never seeds categories', async () => {
    const fixture = await createTestApp()
    const school = (await fixture.schoolRepositories.schools.list())[0]!
    await fixture.forActor(createPlatformRegisterTestActor('new-school')).setupWorkflow.registerSchool({ id: 'new-school', name: 'New school', timeZone: 'UTC', financeCurrency: 'USD' })
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(0)
    await expect(requireSubjectCategory(fixture.schoolRepositories, school.id, 'missing')).rejects.toMatchObject({ code: 'SUBJECT_CATEGORY_NOT_FOUND' })
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(0)
  })
  test('reuses deterministic IDs and same-school names without renaming user records', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    const id = defaultSubjectCategoryId(schoolId, 'Scientifique')
    await fixture.schoolRepositories.subjectCategories.save(new SubjectCategoryEntity({ id, schoolId, name: 'Renamed science' }))
    await fixture.schoolRepositories.subjectCategories.save(new SubjectCategoryEntity({ id: 'custom-art', schoolId, name: 'Arts' }))
    const first = await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog)
    const second = await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog)
    expect(first).toEqual(second)
    expect(first.get('SCI')).toBe(id)
    expect(first.get('ART')).toBe('custom-art')
    expect((await fixture.schoolRepositories.subjectCategories.findById(id))!.name).toBe('Renamed science')
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(2)
    await expect(requireSubjectCategory(fixture.schoolRepositories, 'another-school', id)).rejects.toMatchObject({ code: 'SUBJECT_CATEGORY_NOT_FOUND' })
  })
  test('category initialization rolls back with its surrounding transaction', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    await expect(fixture.app.baseService.atomicExecution.execute(async () => {
      await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog)
      throw new Error('later subject failure')
    })).rejects.toThrow('later subject failure')
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(0)
  })
  test('structure failure rolls back categories created before its subjects', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    await fixture.schoolRepositories.academicYears.save(new AcademicYear({ id: 'category-year', schoolId, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
    await fixture.schoolRepositories.academicDisciplines.save(new AcademicDiscipline({ id: 'conflicting', schoolId, code: 'MATH', name: 'Conflicting name' }))
    const actor = fixture.app.baseService.actor
    await expect(applyStructureTemplate(fixture.application, actor, {
      templates: ['ci-college'],
      levels: [{ gradeLevelId: 'ci-college:4EME', classCount: 1, capacity: 30 }],
      dataset: createOnboardingTestDataset(),
    })).rejects.toMatchObject({ code: 'STRUCTURE_DISCIPLINE_CONFLICT' })
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(0)
    expect(await fixture.schoolRepositories.subjects.count()).toBe(0)
  })
})
