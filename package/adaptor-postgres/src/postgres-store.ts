import type { BaseRepositoryInterface, Filter, QueryOptions } from '@edaya/core'
import { asc, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import {
  batchSaveChunkSize,
  buildConflictUpdateSet,
  chunkArray,
} from './lib/bulk-upsert'
import { buildWhereClause } from './lib/filter'
import { transactionContext } from './lib/transaction'

export class PostgresStore<T extends { readonly id: string }>
implements BaseRepositoryInterface<T> {
  constructor(
    private readonly db: any,
    private readonly table: any,
    private readonly toRow: (entity: T) => any,
    private readonly toDomain: (row: any) => T,
  ) {}

  protected getClient() {
    const tx = transactionContext.getStore()
    return tx ?? this.db
  }

  async findById(id: string): Promise<T | undefined> {
    const rows = await this.getClient()
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))

    if (rows.length === 0) {
      return undefined
    }
    return this.toDomain(rows[0])
  }

  async findByIds(ids: readonly string[]): Promise<T[]> {
    if (ids.length === 0) {
      return []
    }
    const rows = await this.getClient()
      .select()
      .from(this.table)
      .where(inArray(this.table.id, [...ids]))

    return rows.map((r: any) => this.toDomain(r))
  }

  async findOne(options?: QueryOptions<T>, last?: boolean): Promise<T | undefined> {
    const results = await this.list(options)
    if (results.length === 0) {
      return undefined
    }
    return last ? results[results.length - 1] : results[0]
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    let query = this.getClient().select().from(this.table)

    if (options) {
      const whereClause = buildWhereClause(this.table, options)
      if (whereClause) {
        query = query.where(whereClause)
      }

      if (options.$orderBy && options.$orderBy.length > 0) {
        const orderByClauses = options.$orderBy.map(({ field, direction }) => {
          const col = this.table[field as string]
          return direction === 'asc' ? asc(col) : desc(col)
        })
        query = query.orderBy(...orderByClauses)
      }

      if (options.$limit !== undefined) {
        query = query.limit(options.$limit)
      }
      if (options.$offset !== undefined) {
        query = query.offset(options.$offset)
      }
    }

    const rows = await query
    return rows.map((r: any) => this.toDomain(r))
  }

  async count(filter?: Filter<T>): Promise<number> {
    let query = this.getClient().select({ count: sql<number>`count(*)` }).from(this.table)

    if (filter) {
      const whereClause = buildWhereClause(this.table, filter)
      if (whereClause) {
        query = query.where(whereClause)
      }
    }

    const rows = await query
    return Number(rows[0]?.count ?? 0)
  }

  async save(entity: T): Promise<void> {
    const client = this.getClient()
    const row = this.toRow(entity)
    await client
      .insert(this.table)
      .values(row)
      .onConflictDoUpdate({
        target: this.table.id,
        set: row,
      })
  }

  async delete(id: string): Promise<void> {
    await this.getClient()
      .delete(this.table)
      .where(eq(this.table.id, id))
  }

  async batchSave(entities: T[]): Promise<string[]> {
    if (entities.length === 0) {
      return []
    }
    const client = this.getClient()
    const rows = entities.map(entity => this.toRow(entity))
    const columnCount = Object.keys(getTableColumns(this.table)).length
    const chunks = chunkArray(rows, batchSaveChunkSize(columnCount))
    const conflictSet = buildConflictUpdateSet(this.table)

    for (const chunk of chunks) {
      await client
        .insert(this.table)
        .values(chunk)
        .onConflictDoUpdate({
          target: this.table.id,
          set: conflictSet,
        })
    }
    return entities.map(e => e.id)
  }

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return
    }
    await this.getClient()
      .delete(this.table)
      .where(inArray(this.table.id, [...ids]))
  }
}
