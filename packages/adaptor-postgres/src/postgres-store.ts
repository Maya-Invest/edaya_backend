import type { BaseRepositoryInterface, Filter, QueryOptions } from '@edaya/core'
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, notInArray, or, sql } from 'drizzle-orm'
import { transactionContext } from './postgres-repositories'

export function deserializeJsonb(value: any): any {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value), (_key, val) => {
    if (
      typeof val === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(val)
    ) {
      const date = new Date(val)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
    return val
  })
}

export function buildWhereClause(table: any, filter: any): any {
  if (!filter)
    return undefined

  const conditions: any[] = []

  for (const key of Object.keys(filter)) {
    if (key.startsWith('$')) {
      if (key === '$and' && Array.isArray(filter.$and)) {
        const sub = filter.$and.map((f: any) => buildWhereClause(table, f)).filter(Boolean)
        if (sub.length > 0)
          conditions.push(and(...sub))
      }
      else if (key === '$or' && Array.isArray(filter.$or)) {
        const sub = filter.$or.map((f: any) => buildWhereClause(table, f)).filter(Boolean)
        if (sub.length > 0)
          conditions.push(or(...sub))
      }
      else if (key === '$not' && filter.$not) {
        const sub = buildWhereClause(table, filter.$not)
        if (sub)
          conditions.push(not(sub))
      }
      continue
    }

    const column = table[key]
    if (!column)
      continue

    const fieldFilter = filter[key]
    if (
      fieldFilter
      && typeof fieldFilter === 'object'
      && !(fieldFilter instanceof Date)
      && !Array.isArray(fieldFilter)
    ) {
      for (const op of Object.keys(fieldFilter)) {
        const val = fieldFilter[op]
        switch (op) {
          case '$eq':
            conditions.push(eq(column, val))
            break
          case '$ne':
            conditions.push(ne(column, val))
            break
          case '$gt':
            conditions.push(gt(column, val))
            break
          case '$gte':
            conditions.push(gte(column, val))
            break
          case '$lt':
            conditions.push(lt(column, val))
            break
          case '$lte':
            conditions.push(lte(column, val))
            break
          case '$in':
            if (Array.isArray(val)) {
              if (val.length === 0) {
                conditions.push(sql`false`)
              }
              else {
                conditions.push(inArray(column, val))
              }
            }
            break
          case '$nin':
            if (Array.isArray(val)) {
              if (val.length > 0) {
                conditions.push(notInArray(column, val))
              }
            }
            break
          case '$exists':
            if (val === true) {
              conditions.push(isNotNull(column))
            }
            else if (val === false) {
              conditions.push(isNull(column))
            }
            break
          default:
            break
        }
      }
    }
    else {
      conditions.push(eq(column, fieldFilter))
    }
  }

  if (conditions.length === 0)
    return undefined
  if (conditions.length === 1)
    return conditions[0]
  return and(...conditions)
}

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

    if (rows.length === 0)
      return undefined
    return this.toDomain(rows[0])
  }

  async findByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0)
      return []
    const rows = await this.getClient()
      .select()
      .from(this.table)
      .where(inArray(this.table.id, ids))

    return rows.map((r: any) => this.toDomain(r))
  }

  async findOne(options?: QueryOptions<T>, last?: boolean): Promise<T | undefined> {
    const results = await this.list(options)
    if (results.length === 0)
      return undefined
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
          return direction === 'asc' ? col.asc() : col.desc()
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
    if (entities.length === 0)
      return []
    const client = this.getClient()
    for (const entity of entities) {
      const row = this.toRow(entity)
      await client
        .insert(this.table)
        .values(row)
        .onConflictDoUpdate({
          target: this.table.id,
          set: row,
        })
    }
    return entities.map(e => e.id)
  }

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0)
      return
    await this.getClient()
      .delete(this.table)
      .where(inArray(this.table.id, ids))
  }
}

export function createDefaultMappers<T extends { readonly id: string }>(
  Ctor: new (args: any) => T,
): {
  toRow: (entity: T) => any
  toDomain: (row: any) => T
} {
  return {
    toRow: (entity: T): any => {
      const row: any = {}
      const dataSource = (entity && typeof entity === 'object' && 'data' in entity && entity.data && typeof entity.data === 'object') ? entity.data : entity
      for (const key of Object.keys(dataSource)) {
        const val = (dataSource as any)[key]
        row[key] = val === undefined ? null : val
      }
      return row
    },
    toDomain: (row: any): T => {
      const args: any = {}
      for (const key of Object.keys(row)) {
        const val = row[key]
        args[key] = val === null ? undefined : val
      }
      return new Ctor(args)
    },
  }
}
