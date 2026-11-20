import type { BaseRepositoryInterface } from '@edaya/core'

interface EntityWithId {
  readonly id: string
}

interface TransactionParticipant {
  begin: () => void
  commit: () => void
  rollback: () => void
}

export function createStore<T extends EntityWithId>(participants: TransactionParticipant[] = []): BaseRepositoryInterface<T> {
  const entries = new Map<string, T>()
  let snapshot: Map<string, T> | undefined
  participants.push({
    begin: () => {
      snapshot = new Map(entries)
    },
    commit: () => {
      snapshot = undefined
    },
    rollback: () => {
      entries.clear()
      for (const [id, entity] of snapshot ?? []) {
        entries.set(id, entity)
      }
      snapshot = undefined
    },
  })

  return {
    forAccess: () => { throw new Error('Authorization tests require the native scoped repository') },
    assertAccess: async () => { throw new Error('Authorization tests require the native scoped repository') },
    findById: async (id: string) => entries.get(id),
    findOne: async () => undefined,
    findByIds: async (ids: readonly string[]) => ids.map(id => entries.get(id)).filter((entity): entity is T => entity !== undefined),
    list: async () => [...entries.values()],
    count: async () => entries.size,
    save: async (entity: T) => {
      entries.set(entity.id, entity)
    },
    delete: async (id: string) => {
      entries.delete(id)
    },
    batchSave: async (entities: T[]) => {
      for (const entity of entities) entries.set(entity.id, entity)
      return entities.map(entity => entity.id)
    },
    batchDelete: async (ids: string[]) => {
      for (const id of ids) entries.delete(id)
    },
  } satisfies BaseRepositoryInterface<T>
}
