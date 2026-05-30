import type { BaseRepositoryInterface, Filter, QueryOptions } from '@edaya/core'
import { matchesFilter } from '@edaya/adaptor-in-memory-db'
import { and, eq, inArray } from 'drizzle-orm'
import { transactionContext } from './postgres-repositories'
import { entityStore } from './postgres-schema'

export class PostgresStore<T extends { readonly id: string }> implements BaseRepositoryInterface<T> {
  constructor(
    private readonly db: any,
    private readonly entityType: string,
    private readonly constructorFn: new (args: any) => T,
  ) {}

  private getClient() {
    const tx = transactionContext.getStore()
    return tx ?? this.db
  }

  private deserialize(row: any): T {
    // recursively parse dates from serialized JSON
    const data = JSON.parse(JSON.stringify(row.data), (_key, value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) {
          return date
        }
      }
      return value
    })

    // Flatten Money objects back to constructor args shape
    if (this.entityType === 'Fee') {
      if (data.defaultAmount && typeof data.defaultAmount === 'object') {
        data.currency = data.defaultAmount.currency
        data.defaultAmount = data.defaultAmount.amount
      }
    }
    else if (this.entityType === 'StudentFee') {
      if (data.expectedAmount && typeof data.expectedAmount === 'object') {
        data.currency = data.expectedAmount.currency
        data.expectedAmount = data.expectedAmount.amount
      }
      if (data.paidAmount && typeof data.paidAmount === 'object') {
        data.paidAmount = data.paidAmount.amount
      }
      if (data.adjustmentAmount && typeof data.adjustmentAmount === 'object') {
        data.adjustmentAmount = data.adjustmentAmount.amount
      }
    }
    else if (this.entityType === 'Payment') {
      if (data.amount && typeof data.amount === 'object') {
        data.currency = data.amount.currency
        data.amount = data.amount.amount
      }
    }

    const Ctor = this.constructorFn
    return new Ctor(data)
  }

  async findById(id: string): Promise<T | undefined> {
    const rows = await this.getClient()
      .select()
      .from(entityStore)
      .where(and(eq(entityStore.entityType, this.entityType), eq(entityStore.id, id)))

    if (rows.length === 0)
      return undefined
    return this.deserialize(rows[0])
  }

  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0)
      return []
    const rows = await this.getClient()
      .select()
      .from(entityStore)
      .where(
        and(
          eq(entityStore.entityType, this.entityType),
          inArray(entityStore.id, ids),
        ),
      )

    return rows.map((r: any) => this.deserialize(r))
  }

  async findOne(options?: QueryOptions<T>, last?: boolean): Promise<T | undefined> {
    const results = await this.list(options)
    if (results.length === 0)
      return undefined
    return last ? results[results.length - 1] : results[0]
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    const rows = await this.getClient()
      .select()
      .from(entityStore)
      .where(eq(entityStore.entityType, this.entityType))

    let result = rows.map((r: any) => this.deserialize(r))

    if (options) {
      const filter: any = {}
      for (const key of Object.keys(options)) {
        if (!key.startsWith('$')) {
          filter[key] = (options as any)[key]
        }
      }
      if (Object.keys(filter).length > 0) {
        result = result.filter((entity: T) => matchesFilter(entity, filter))
      }

      if (options.$orderBy) {
        result.sort((a: T, b: T) => {
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
    const all = await this.list()
    if (!filter) {
      return all.length
    }
    return all.filter((entity: T) => matchesFilter(entity, filter)).length
  }

  async save(entity: T): Promise<void> {
    const client = this.getClient()
    await client
      .insert(entityStore)
      .values({
        entityType: this.entityType,
        id: entity.id,
        data: entity,
      })
      .onConflictDoUpdate({
        target: [entityStore.entityType, entityStore.id],
        set: { data: entity },
      })
  }

  async delete(id: string): Promise<void> {
    await this.getClient()
      .delete(entityStore)
      .where(and(eq(entityStore.entityType, this.entityType), eq(entityStore.id, id)))
  }

  async batchSave(entities: T[]): Promise<string[]> {
    if (entities.length === 0)
      return []
    const client = this.getClient()

    for (const entity of entities) {
      await client
        .insert(entityStore)
        .values({
          entityType: this.entityType,
          id: entity.id,
          data: entity,
        })
        .onConflictDoUpdate({
          target: [entityStore.entityType, entityStore.id],
          set: { data: entity },
        })
    }

    return entities.map(e => e.id)
  }

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0)
      return
    const client = this.getClient()
    for (const id of ids) {
      await client
        .delete(entityStore)
        .where(and(eq(entityStore.entityType, this.entityType), eq(entityStore.id, id)))
    }
  }
}
