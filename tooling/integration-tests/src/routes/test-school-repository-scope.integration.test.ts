import type { BaseRepositoryInterface } from '@edaya/core'
import { Subject, SubjectMatter } from '@edaya/core'
import { CORE_ENTITY_KEYS } from '@edaya/service'
import { expect, it } from 'bun:test'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('trusted school repository scope', (getContext) => {
  it('provides a working SQL scope for every managed entity, including custom stores', async () => {
    const { application } = getContext()
    const school = (await application.repositories.schools.list({ $limit: 1 }))[0]!
    for (const key of CORE_ENTITY_KEYS) {
      const repository = application.repositories[key] as BaseRepositoryInterface<unknown>
      expect(repository.forSchool).toBeDefined()
      const scoped = repository.forSchool!(school.id)
      expect(await scoped.count()).toBeGreaterThanOrEqual(0)
      expect((await scoped.list({ $limit: 1 })).length).toBeLessThanOrEqual(1)
    }
  })

  it('scopes indirect HTTP list/count/findOne before pagination and ignores foreign IDs', async () => {
    const { application, app, authHeaders } = getContext()
    const repos = application.repositories
    const school = (await repos.schools.list({ $limit: 1 }))[0]!
    await repos.subjects.save(new Subject({ id: 'scope-foreign-subject', schoolId: 'other-school', name: 'Foreign' }))
    await repos.subjects.save(new Subject({ id: 'scope-local-subject', schoolId: school.id, name: 'Local' }))
    for (const [id, subjectId] of [['0-foreign-matter', 'scope-foreign-subject'], ['1-local-matter', 'scope-local-subject'], ['2-local-matter', 'scope-local-subject']]) {
      await repos.subjectMatters.save(new SubjectMatter({ id: id!, subjectId: subjectId!, name: 'Scope test', sequenceOrder: 1 }))
    }
    const headers = await authHeaders()
    const request = (action: string, body: unknown) => app.request(`/core/entities/subject-matters/${action}`, { method: 'POST', headers, body: JSON.stringify(body) })
    const filter = { $or: [{ subjectId: 'scope-foreign-subject' }, { subjectId: 'scope-local-subject' }] }
    const list = await request('list', { ...filter, $limit: 1, $offset: 1 })
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject([{ id: '2-local-matter' }])
    const count = await request('count', filter)
    expect(count.status).toBe(200)
    expect(await count.json() as { count: number }).toEqual({ count: 2 })
    const one = await request('one', filter)
    expect(one.status).toBe(200)
    expect(await one.json()).toMatchObject({ id: '1-local-matter' })
    expect((await app.request('/core/entities/subject-matters/0-foreign-matter', { headers })).status).toBe(404)
    const scoped = repos.subjectMatters.forSchool!(school.id)
    expect((await scoped.findByIds(['0-foreign-matter', '1-local-matter'])).map(row => row.id)).toEqual(['1-local-matter'])
  })

  it('rejects foreign proposed ownership and ID collisions in SQL and rolls back a mixed batch', async () => {
    const { application } = getContext()
    const repos = application.repositories
    const subject = (await repos.subjects.findById('scope-local-subject'))!
    const scoped = repos.subjectMatters.forSchool!(subject.schoolId)
    const matter = (id: string, subjectId: string) => new SubjectMatter({ id, subjectId, name: 'Attempted write', sequenceOrder: 1 })
    await expect(scoped.save(matter('scope-invalid-insert', 'scope-foreign-subject'))).rejects.toThrow()
    await expect(scoped.save(matter('0-foreign-matter', 'scope-local-subject'))).rejects.toThrow()
    await expect(scoped.batchSave([matter('scope-rolled-back', 'scope-local-subject'), matter('0-foreign-matter', 'scope-local-subject')])).rejects.toThrow()
    expect(await repos.subjectMatters.findById('scope-invalid-insert')).toBeUndefined()
    expect(await repos.subjectMatters.findById('scope-rolled-back')).toBeUndefined()
    expect((await repos.subjectMatters.findById('0-foreign-matter'))?.subjectId).toBe('scope-foreign-subject')
    await scoped.delete('0-foreign-matter')
    await scoped.batchDelete(['0-foreign-matter'])
    expect(await repos.subjectMatters.findById('0-foreign-matter')).toBeDefined()
    await scoped.save(matter('scope-valid-insert', 'scope-local-subject'))
    expect(await scoped.findById('scope-valid-insert')).toBeDefined()
  })

  it('rejects mixed-school HTTP writes before any local mutation', async () => {
    const { application, app, authHeaders } = getContext()
    const repos = application.repositories
    const headers = await authHeaders()
    const request = (action: string, body: unknown) => app.request(`/core/entities/subject-matters/${action}`, { method: 'POST', headers, body: JSON.stringify(body) })
    const proposed = (id: string) => new SubjectMatter({ id, subjectId: 'scope-local-subject', name: 'HTTP mutation', sequenceOrder: 1 }).data
    expect((await request('save', proposed('0-foreign-matter'))).status).toBe(403)
    expect((await request('batch-save', { entities: [proposed('http-rolled-back'), proposed('0-foreign-matter')] })).status).toBe(403)
    expect(await repos.subjectMatters.findById('http-rolled-back')).toBeUndefined()
    expect((await request('batch-delete', { ids: ['1-local-matter', '0-foreign-matter'] })).status).toBe(403)
    expect(await repos.subjectMatters.findById('1-local-matter')).toBeDefined()
    expect(await repos.subjectMatters.findById('0-foreign-matter')).toBeDefined()
    expect((await request('save', proposed('http-valid-insert'))).status).toBe(200)
    expect((await repos.subjectMatters.findById('http-valid-insert'))?.subjectId).toBe('scope-local-subject')
  })

  it('keeps notification-template school aliases scoped inside nested filters', async () => {
    const { application } = getContext()
    const school = (await application.repositories.schools.list({ $limit: 1 }))[0]!
    const scoped = application.repositories.schoolNotificationTemplates.forSchool!(school.id)
    const expected = await scoped.count()
    expect(await scoped.count({ $or: [{ schoolId: school.id }, { schoolId: 'other-school' }] })).toBe(expected)
    expect(await scoped.count({ $and: [{ schoolId: school.id }, { id: 'other-school' }] })).toBe(0)
    expect(await scoped.findById('other-school')).toBeUndefined()
  })
}, { isolate: true })
