import { describe, expect, it } from 'bun:test'
import { InMemoryStore } from '../../src/in-memory-store'

interface SampleEntity {
  readonly id: string
  readonly value: string
}

describe('In-memory store CRUD operations', () => {
  it('saves, retrieves, lists, and counts entities successfully', async () => {
    const repository = new InMemoryStore<SampleEntity>()
    const entity = { id: 'one', value: 'first' }

    await repository.save(entity)

    expect(await repository.findById('one')).toEqual(entity)
    expect(await repository.list()).toEqual([entity])
    expect(await repository.count()).toBe(1)
  })

  it('updates entities correctly by unique identity', async () => {
    const repository = new InMemoryStore<SampleEntity>()
    const original = { id: 'one', value: 'first' }
    const replacement = { id: 'one', value: 'second' }
    await repository.save(original)

    await repository.save(replacement)
    expect(await repository.findById('one')).toEqual(replacement)
  })

  it('deletes entities from map storage cleanly', async () => {
    const repository = new InMemoryStore<SampleEntity>()
    const entity = { id: 'one', value: 'first' }
    await repository.save(entity)

    await repository.delete(entity.id)
    expect(await repository.findById('one')).toBeUndefined()
    expect(await repository.count()).toBe(0)
  })
})
