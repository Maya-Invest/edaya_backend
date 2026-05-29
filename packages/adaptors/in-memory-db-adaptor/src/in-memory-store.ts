import type { BaseRepositoryInterface, Filter, QueryOptions } from 'maya_school_core'
import { matchesFilter } from './filter-matcher'

export interface EntityWithId {
  readonly id: string
}

export interface TransactionParticipant {
  begin: () => void
  commit: () => void
  rollback: () => void
}

export class InMemoryStore<T extends EntityWithId> implements BaseRepositoryInterface<T>, TransactionParticipant {
  private entries = new Map<string, T>()
  private snapshot: Map<string, T> | undefined

  begin(): void {
    this.snapshot = new Map(this.entries)
  }

  commit(): void {
    this.snapshot = undefined
  }

  rollback(): void {
    this.entries.clear()
    if (this.snapshot) {
      for (const [id, entity] of this.snapshot) {
        this.entries.set(id, entity)
      }
    }
    this.snapshot = undefined
  }

  async findById(id: string): Promise<T | undefined> {
    return this.entries.get(id)
  }

  async findByIds(ids: string[]): Promise<T[]> {
    return ids.map(id => this.entries.get(id)).filter((entity): entity is T => entity !== undefined)
  }

  async findOne(options?: QueryOptions<T>, last?: boolean): Promise<T | undefined> {
    const results = await this.list(options)
    if (results.length === 0) {
      return undefined
    }
    return last ? results[results.length - 1] : results[0]
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    let result = [...this.entries.values()]
    if (options) {
      // Extract filter by omitting $ prefixed keys from the QueryOptions object
      const filter: any = {}
      for (const key of Object.keys(options)) {
        if (!key.startsWith('$')) {
          filter[key] = (options as any)[key]
        }
      }
      if (Object.keys(filter).length > 0) {
        result = result.filter(entity => matchesFilter(entity, filter))
      }

      if (options.$orderBy) {
        result.sort((a, b) => {
          for (const { field, direction } of options.$orderBy!) {
            const valA = (a as any)[field]
            const valB = (b as any)[field]
            if (valA < valB)
              return direction === 'asc' ? -1 : 1
            if (valA > valB)
              return direction === 'asc' ? 1 : -1
          }
          return 0
        })
      }

      if (options.$offset !== undefined || options.$limit !== undefined) {
        const offset = options.$offset ?? 0
        result = result.slice(offset, options.$limit !== undefined ? offset + options.$limit : undefined)
      }
    }
    return result
  }

  async count(filter?: Filter<T>): Promise<number> {
    const all = [...this.entries.values()]
    if (!filter) {
      return all.length
    }
    return all.filter(entity => matchesFilter(entity, filter)).length
  }

  async save(entity: T): Promise<void> {
    this.entries.set(entity.id, entity)
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id)
  }

  async batchSave(entities: T[]): Promise<string[]> {
    for (const entity of entities) {
      this.entries.set(entity.id, entity)
    }
    return entities.map(e => e.id)
  }

  async batchDelete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.entries.delete(id)
    }
  }

  // Helper for tests/resets
  clear(): void {
    this.entries.clear()
    this.snapshot = undefined
  }
}
