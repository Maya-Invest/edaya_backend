import { SubjectCategoryEntity, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { ensureDatasetSubjectCategories, requireSubjectCategory } from '../../../src/capabilities/academics/dataset-subject-categories'
import { createTestApp } from '../../support/create-test-app'
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
  test('binds dataset keys to opaque IDs without merging duplicate display names', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    const id = 'user-science'
    await fixture.schoolRepositories.subjectCategories.save(new SubjectCategoryEntity(withShortName({ id, schoolId, name: 'Renamed science' })))
    await fixture.schoolRepositories.subjectCategories.save(new SubjectCategoryEntity(withShortName({ id: 'custom-art', schoolId, name: 'Arts' })))
    const first = await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog, fixture.application.commandExecution)
    const second = await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog, fixture.application.commandExecution)
    expect(first).toEqual(second)
    expect(first.get('SCI')).not.toBe(id)
    expect(first.get('ART')).not.toBe('custom-art')
    expect((await fixture.schoolRepositories.subjectCategories.findById(id))!.name).toBe('Renamed science')
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(4)
    await expect(requireSubjectCategory(fixture.schoolRepositories, 'another-school', id)).rejects.toMatchObject({ code: 'SUBJECT_CATEGORY_NOT_FOUND' })
  })
  test('category initialization rolls back with its surrounding transaction', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    await expect(fixture.app.baseService.atomicExecution.execute(async () => {
      await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, catalog, fixture.application.commandExecution)
      throw new Error('later subject failure')
    })).rejects.toThrow('later subject failure')
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(0)
  })
  test('distinct dataset keys may have identical display names and survive a rename', async () => {
    const fixture = await createTestApp()
    const schoolId = (await fixture.schoolRepositories.schools.list())[0]!.id
    const definitions = [{ code: 'FIRST', name: 'Arts', shortName: 'Arts' }, { code: 'SECOND', name: 'Arts', shortName: 'Arts' }]
    const first = await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, definitions, fixture.application.commandExecution, 'dataset-v1')
    expect(first.get('FIRST')).not.toBe(first.get('SECOND'))
    const category = (await fixture.schoolRepositories.subjectCategories.findById(first.get('FIRST')!))!
    await fixture.schoolRepositories.subjectCategories.save(category.copyWith({ name: 'Renamed' }))
    expect(await ensureDatasetSubjectCategories(fixture.schoolRepositories, schoolId, definitions, fixture.application.commandExecution, 'dataset-v1')).toEqual(first)
    expect((await fixture.schoolRepositories.subjectCategories.findById(category.id))!.name).toBe('Renamed')
    expect(await fixture.schoolRepositories.subjectCategories.count()).toBe(2)
  })
})
