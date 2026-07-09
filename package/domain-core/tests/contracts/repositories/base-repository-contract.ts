import type { BaseRepositoryInterface } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

interface EntityWithId {
  readonly id: string
}

export function runBaseRepositoryContract<T extends EntityWithId>(
  name: string,
  createRepository: () => BaseRepositoryInterface<T>,
  createEntity: (id: string, value: string) => T,
) {
  describe(name, () => {
    it('saves, retrieves, lists, and counts entities', async () => {
      const repository = createRepository()
      const entity = createEntity('one', 'first')

      await repository.save(entity)

      expect(await repository.findById('one')).toEqual(entity)
      expect(await repository.list()).toEqual([entity])
      expect(await repository.count()).toBe(1)
    })

    it('updates by identity and deletes entities', async () => {
      const repository = createRepository()
      const original = createEntity('one', 'first')
      const replacement = createEntity('one', 'second')
      await repository.save(original)

      await repository.save(replacement)
      expect(await repository.findById('one')).toEqual(replacement)

      await repository.delete(replacement.id)
      expect(await repository.findById('one')).toBeUndefined()
      expect(await repository.count()).toBe(0)
    })
  })
}
