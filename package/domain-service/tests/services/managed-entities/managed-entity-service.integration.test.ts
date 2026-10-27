import type { EntityBusinessGates, EntityBusinessHooks } from '@edaya/service'
import { Student } from '@edaya/core'
import { ManagedEntityService } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'

async function context(gates: EntityBusinessGates<Student> = {}, hooks: EntityBusinessHooks<Student> = {}) {
  const fixture = await createTestApp()
  const service = new ManagedEntityService<Student>({
    actor: fixture.app.baseService.actor,
    repositories: fixture.schoolRepositories,
    config: { resource: 'students', repository: fixture.schoolRepositories.students, tenant: { resolve: entity => entity.schoolId, resolveFromFilter: filter => typeof filter?.schoolId === 'string' ? filter.schoolId : undefined }, atomicExecution: fixture.atomicExecution, gates, hooks },
  })
  return { ...fixture, service }
}
const student = (id = 'student') => new Student({ id, schoolId: 'school', firstName: 'A', lastName: 'Student' })

describe('managed entities with native policy scopes', () => {
  test('list, single, count and pagination use the same tenant scope', async () => {
    const { service, schoolRepositories } = await context()
    await service.batchSave([student('a'), student('b')])
    await schoolRepositories.students.save(new Student({ id: 'foreign', schoolId: 'other-school', firstName: 'Other', lastName: 'Student' }))
    expect((await service.findByIds(['a', 'foreign'])).map(row => row.id)).toEqual(['a'])
    expect(await service.findById('foreign')).toBeUndefined()
    expect(await service.findOne({ id: 'missing' })).toBeUndefined()
    expect(await service.count()).toBe(2)
    expect((await service.list({ $orderBy: [{ field: 'id', direction: 'asc' }], $offset: 1, $limit: 1 })).map(row => row.id)).toEqual(['b'])
    await expect(service.list({ schoolId: 'other-school' })).rejects.toThrow()
  })

  test('business gates and hooks receive the previous persisted state', async () => {
    const changes: Array<[string, string | undefined]> = []
    const hooks: Array<[string, string | undefined]> = []
    const { service } = await context({
      preSave: async (after, before) => {
        changes.push([after.firstName, before?.firstName])
      },
    }, {
      postSave: async (after, before) => {
        hooks.push([after.firstName, before?.firstName])
      },
    })
    await service.save(student())
    await service.save(student().copyWith({ firstName: 'Updated' }))
    expect(changes).toEqual([['A', undefined], ['Updated', 'A']])
    expect(hooks).toEqual(changes)
  })

  test('post-save failure rolls back all persisted rows in a batch', async () => {
    const { service, schoolRepositories } = await context({}, { postSave: async (entity) => {
      if (entity.id === 'b')
        throw new Error('Hook failed')
    } })
    await expect(service.batchSave([student('a'), student('b')])).rejects.toThrow('Hook failed')
    expect(await schoolRepositories.students.count()).toBe(0)
  })

  test('a failed delete invariant preserves every row and does not call deletion hooks', async () => {
    let hookCalls = 0
    const { service } = await context({ preDelete: async (entity) => {
      if (entity.id === 'b')
        throw new Error('Student still enrolled')
    } }, { postDelete: async () => { hookCalls += 1 } })
    await service.batchSave([student('a'), student('b')])
    await expect(service.batchDelete(['a', 'b'])).rejects.toThrow('Student still enrolled')
    expect(await service.count()).toBe(2)
    expect(hookCalls).toBe(0)
    await service.delete('a')
    expect(hookCalls).toBe(1)
  })

  test('duplicate batch IDs and tenant-conflicting identities cannot overwrite records', async () => {
    const { service, schoolRepositories } = await context()
    await expect(service.batchSave([student('a'), student('a')])).rejects.toThrow()
    await schoolRepositories.students.save(new Student({ id: 'foreign', schoolId: 'other-school', firstName: 'Foreign', lastName: 'Student' }))
    await expect(service.save(student('foreign'))).rejects.toThrow()
    expect((await schoolRepositories.students.findById('foreign'))?.schoolId).toBe('other-school')
    await expect(service.batchDelete(['foreign'])).rejects.toThrow()
  })
})
